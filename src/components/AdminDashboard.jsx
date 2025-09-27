import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Package,
  Users,
  Building,
  ClipboardList,
  LogOut,
  Plus,
  Search,
  Edit,
  Trash2,
  Save,
  X,
  ChevronDown,
  AlertCircle,
  Calendar,
  UserPlus,
  UserMinus,
  Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('sessions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tabs = [
    { id: 'sessions', label: 'Sessions', icon: ClipboardList },
    { id: 'items', label: 'Items', icon: Package },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'categories', label: 'Categories & Locations', icon: Building },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600 hidden sm:block">
                Welcome, {user?.user_metadata?.name || user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-red-600 hover:text-red-800 flex items-center space-x-1"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 flex items-center p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            <AlertCircle className="h-4 w-4 mr-2" />
            {error}
          </div>
        )}

        {activeTab === 'sessions' && <SessionsManager />}
        {activeTab === 'items' && <ItemsManager />}
        {activeTab === 'users' && <UsersManager />}
        {activeTab === 'categories' && <CategoriesManager />}
      </main>
    </div>
  );
};

// Sessions Manager Component
const SessionsManager = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [showUserAssignment, setShowUserAssignment] = useState(false);
  const [showItemSelection, setShowItemSelection] = useState(false);
  const [selectedSessionForAssignment, setSelectedSessionForAssignment] = useState(null);
  const [selectedSessionForItems, setSelectedSessionForItems] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          session_users (
            user_id
          )
        `)
        .order('created_date', { ascending: false });

      if (data) {
        // Fetch profiles for all unique user_ids
        const userIds = [...new Set(data.flatMap(session =>
          session.session_users?.map(su => su.user_id) || []
        ))];

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, username')
            .in('id', userIds);

          // Create a map for quick lookup
          const profileMap = {};
          profiles?.forEach(profile => {
            profileMap[profile.id] = profile;
          });

          // Attach profiles to session_users
          data.forEach(session => {
            session.session_users?.forEach(su => {
              su.profiles = profileMap[su.user_id];
            });
          });
        }
      }

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = () => {
    setEditingSession(null);
    setShowEditor(true);
  };

  const handleEditSession = (session) => {
    setEditingSession(session);
    setShowEditor(true);
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this session? All count data will be lost.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      await fetchSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const handleManageUsers = (session) => {
    setSelectedSessionForAssignment(session);
    setShowUserAssignment(true);
  };

  const handleManageItems = (session) => {
    setSelectedSessionForItems(session);
    setShowItemSelection(true);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const exportReport = async (session) => {
    try {
      // Fetch session items with counts
      const { data: sessionItems, error: sessionItemsError } = await supabase
        .from('session_items')
        .select(`
          items (
            id,
            sku,
            item_name
          )
        `)
        .eq('session_id', session.id);

      if (sessionItemsError) throw sessionItemsError;

      const itemIds = sessionItems.map(si => si.items.id);

      // Fetch counts for this session
      const { data: countsData, error: countsError } = await supabase
        .from('counts')
        .select(`
          *,
          items (
            sku,
            item_name
          ),
          locations (
            name
          )
        `)
        .eq('session_id', session.id);

      if (countsError) throw countsError;

      // Fetch user profiles
      const userIds = [...new Set(countsData.map(c => c.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = {};
      profilesData?.forEach(profile => {
        profileMap[profile.id] = profile.name;
      });

      const csvContent = "data:text/csv;charset=utf-8,Session,SKU,Item Name,Location,Counted Qty,User,Timestamp\n";

      const reportData = countsData.map(count => ({
        sessionName: session.name,
        sku: count.items?.sku || '',
        itemName: count.items?.item_name || '',
        location: count.locations?.name || '',
        quantity: count.counted_qty,
        userName: profileMap[count.user_id] || '',
        timestamp: formatDate(count.timestamp)
      }));

      const csvRows = reportData.map(row =>
        `${row.sessionName},"${row.sku}","${row.itemName}",${row.location},${row.quantity},"${row.userName}","${row.timestamp}"`
      ).join('\n');

      const finalContent = csvContent + csvRows;

      const encodedUri = encodeURI(finalContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${session.name}_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting report:', err);
      alert('Error exporting report: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={handleCreateSession}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Create Session</span>
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {sessions.map((session) => (
            <li key={session.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    {session.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center">
                      <ClipboardList className="h-4 w-4 mr-1" />
                      {session.type}
                    </span>
                    <span className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {session.session_users?.length || 0} Counter(s)
                    </span>
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(session.created_date).toLocaleDateString()}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      session.status === 'active' ? 'bg-green-100 text-green-800' :
                      session.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleManageUsers(session)}
                    className="text-blue-600 hover:text-blue-800 p-2"
                    title="Manage Users"
                  >
                    <Users className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleManageItems(session)}
                    className="text-green-600 hover:text-green-800 p-2"
                    title="Manage Items"
                  >
                    <Package className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleEditSession(session)}
                    className="text-indigo-600 hover:text-indigo-800 p-2"
                    title="Edit Session"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => exportReport(session)}
                    className="text-green-600 hover:text-green-800 p-2"
                    title="Export Report"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="text-red-600 hover:text-red-800 p-2"
                    title="Delete Session"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showEditor && (
        <SessionEditor
          session={editingSession}
          onClose={() => setShowEditor(false)}
          onSave={fetchSessions}
        />
      )}

      {showUserAssignment && (
        <UserAssignmentModal
          session={selectedSessionForAssignment}
          onClose={() => {
            setShowUserAssignment(false);
            setSelectedSessionForAssignment(null);
          }}
          onSave={fetchSessions}
        />
      )}

      {showItemSelection && (
        <ItemSelectionModal
          session={selectedSessionForItems}
          onClose={() => {
            setShowItemSelection(false);
            setSelectedSessionForItems(null);
          }}
          onSave={fetchSessions}
        />
      )}
    </div>
  );
};

// Items Manager Component
const ItemsManager = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('item_name');

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleCreateItem = () => {
    setEditingItem(null);
    setShowEditor(true);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setShowEditor(true);
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      await fetchItems();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,SKU,Item Code,Item Name,Category,UOM,Tags\n";
    const sampleRow = "SAMPLE001,SAMPLE001,Sample Item,Electronics,Pcs,tag1;tag2\n";
    const finalContent = csvContent + sampleRow;

    const encodedUri = encodeURI(finalContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "items_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      setBulkError('Please select a CSV file');
      return;
    }

    setBulkUploading(true);
    setBulkError('');

    try {
      const text = await bulkFile.text();
      const rows = text.split('\n').filter(row => row.trim());
      const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));

      // Expected headers: SKU,Item Code,Item Name,Category,UOM,Tags
      const expectedHeaders = ['SKU', 'Item Code', 'Item Name', 'Category', 'UOM', 'Tags'];
      const headerMatch = expectedHeaders.every(h => headers.includes(h));

      if (!headerMatch) {
        throw new Error('CSV must have headers: SKU, Item Code, Item Name, Category, UOM, Tags');
      }

      const dataRows = rows.slice(1);
      const itemsToInsert = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const cols = row.split(',').map(col => col.trim().replace(/"/g, ''));

        if (cols.length !== 6) {
          throw new Error(`Row ${i + 2}: Invalid number of columns`);
        }

        const [sku, itemCode, itemName, category, uom, tags] = cols;

        if (!sku || !itemCode || !itemName || !category || !uom) {
          throw new Error(`Row ${i + 2}: Required fields missing`);
        }

        // Check if category exists
        const categoryExists = categories.some(cat => cat.name === category);
        if (!categoryExists) {
          throw new Error(`Row ${i + 2}: Category "${category}" does not exist`);
        }

        itemsToInsert.push({
          sku,
          item_code: itemCode,
          item_name: itemName,
          category,
          uom,
          tags: tags ? tags.split(';').map(tag => tag.trim()).filter(tag => tag) : []
        });
      }

      if (itemsToInsert.length === 0) {
        throw new Error('No valid items to upload');
      }

      const { error } = await supabase
        .from('items')
        .insert(itemsToInsert);

      if (error) throw error;

      setBulkFile(null);
      setShowBulkModal(false);
      setBulkError('');
      await fetchItems();
      alert(`Successfully uploaded ${itemsToInsert.length} items`);
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Manage Items</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleCreateItem}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Bulk Add</span>
          </button>
        </div>
      </div>


      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                UOM
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {item.sku}
                  </div>
                  <div className="text-sm text-gray-500">
                    {item.item_code}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.item_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.uom}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleEditItem(item)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">Bulk Upload Items</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">
                  Upload a CSV file with columns: SKU, Item Code, Item Name, Category, UOM, Tags (multiple tags separated by semicolons)
                </p>
                <button
                  onClick={downloadTemplate}
                  className="text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  Download Template
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setBulkFile(e.target.files[0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {bulkError && (
                  <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {bulkError}
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => {
                    setShowBulkModal(false);
                    setBulkFile(null);
                    setBulkError('');
                  }}
                  className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
                  disabled={bulkUploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpload}
                  disabled={!bulkFile || bulkUploading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {bulkUploading ? (
                    <div className="spinner w-4 h-4"></div>
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>{bulkUploading ? 'Uploading...' : 'Upload'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditor && (
        <ItemEditor
          item={editingItem}
          categories={categories}
          onClose={() => setShowEditor(false)}
          onSave={fetchItems}
        />
      )}
    </div>
  );
};

// Users Manager Component
const UsersManager = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setShowEditor(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setShowEditor(true);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Manage Users</h3>
        <button
          onClick={handleCreateUser}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add User</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {user.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === 'admin'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleEditUser(user)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEditor && (
        <UserEditor
          user={editingUser}
          onClose={() => setShowEditor(false)}
          onSave={fetchUsers}
        />
      )}
    </div>
  );
};

// Categories Manager Component
const CategoriesManager = () => {
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchLocations();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          categories (
            name
          )
        `)
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (name) => {
    try {
      const { error } = await supabase
        .from('categories')
        .insert([{ name }]);

      if (error) throw error;

      await fetchCategories();
    } catch (err) {
      console.error('Error creating category:', err);
      throw err;
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setShowEditor(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      await fetchCategories();
      await fetchLocations();
    } catch (err) {
      console.error('Error deleting category:', err);
      throw err;
    }
  };

  const handleCreateLocation = async (name, categoryId) => {
    try {
      const { error } = await supabase
        .from('locations')
        .insert([{ name, category_id: categoryId }]);

      if (error) throw error;

      await fetchLocations();
    } catch (err) {
      console.error('Error creating location:', err);
      throw err;
    }
  };

  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setShowLocationEditor(true);
  };

  const handleDeleteLocation = async (locationId) => {
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      await fetchLocations();
    } catch (err) {
      console.error('Error deleting location:', err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <CategoryForm onSubmit={handleCreateCategory} />
      <LocationForm
        categories={categories}
        onSubmit={handleCreateLocation}
      />

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {categories.map((category) => (
          <div key={category.id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <h4 className="font-bold text-gray-800">{category.name}</h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditCategory(category)}
                  className="text-blue-500 hover:text-blue-700"
                  title="Edit Category"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Delete Category"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {locations
                .filter(loc => loc.category_id === category.id)
                .map(loc => (
                  <li key={loc.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <span className="text-gray-700">{loc.name}</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditLocation(loc)}
                        className="text-blue-500 hover:text-blue-700"
                        title="Edit Location"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete Location"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              {locations.filter(loc => loc.category_id === category.id).length === 0 && (
                <p className="text-gray-500 text-sm">No locations defined.</p>
              )}
            </ul>
          </div>
        ))}
      </div>

      {showEditor && (
        <CategoryEditor
          category={editingCategory}
          onClose={() => { setShowEditor(false); setEditingCategory(null); }}
          onSave={() => { fetchCategories(); setShowEditor(false); setEditingCategory(null); }}
        />
      )}

      {showLocationEditor && (
        <LocationEditor
          location={editingLocation}
          categories={categories}
          onClose={() => { setShowLocationEditor(false); setEditingLocation(null); }}
          onSave={() => { fetchLocations(); setShowLocationEditor(false); setEditingLocation(null); }}
        />
      )}
    </div>
  );
};

// Form Components (simplified for brevity)
const CategoryForm = ({ onSubmit }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(name);
    setName('');
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <h3 className="text-lg font-semibold mb-3">Add New Category</h3>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Category</span>
        </button>
      </form>
    </div>
  );
};

const LocationForm = ({ categories, onSubmit }) => {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(name, categoryId);
    setName('');
    setCategoryId('');
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <h3 className="text-lg font-semibold mb-3">Add New Location</h3>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full sm:w-1/3 px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="">Select Category</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New location name"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Location</span>
        </button>
      </form>
    </div>
  );
};

// User Assignment Modal Component
const UserAssignmentModal = ({ session, onClose, onSave }) => {
  const [availableUsers, setAvailableUsers] = useState([]);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (session) {
      fetchUsers();
    }
  }, [session]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Fetch all users
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, name, username')
        .order('name');

      if (usersError) throw usersError;

      // Fetch currently assigned users
      const { data: assigned, error: assignedError } = await supabase
        .from('session_users')
        .select('user_id')
        .eq('session_id', session.id);

      if (assignedError) throw assignedError;

      const assignedUserIds = new Set(assigned.map(a => a.user_id));

      // Separate available and assigned users
      const available = allUsers.filter(user => !assignedUserIds.has(user.id));
      const assignedList = allUsers.filter(user => assignedUserIds.has(user.id));

      setAvailableUsers(available);
      setAssignedUsers(assignedList);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUser = async (userId) => {
    try {
      setAssigning(true);
      const { error } = await supabase
        .from('session_users')
        .insert([{ session_id: session.id, user_id: userId }]);

      if (error) throw error;

      await fetchUsers();
    } catch (err) {
      console.error('Error assigning user:', err);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignUser = async (userId) => {
    try {
      setAssigning(true);
      const { error } = await supabase
        .from('session_users')
        .delete()
        .eq('session_id', session.id)
        .eq('user_id', userId);

      if (error) throw error;

      await fetchUsers();
    } catch (err) {
      console.error('Error unassigning user:', err);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">
            Manage Users for Session: {session?.name}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Available Users */}
              <div>
                <h4 className="text-lg font-semibold mb-4 text-gray-700">Available Users</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {availableUsers.length === 0 ? (
                    <p className="text-gray-500 text-sm">No available users</p>
                  ) : (
                    availableUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">@{user.username}</p>
                        </div>
                        <button
                          onClick={() => handleAssignUser(user.id)}
                          disabled={assigning}
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          title="Assign User"
                        >
                          <UserPlus className="h-5 w-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Assigned Users */}
              <div>
                <h4 className="text-lg font-semibold mb-4 text-gray-700">Assigned Users ({assignedUsers.length})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {assignedUsers.length === 0 ? (
                    <p className="text-gray-500 text-sm">No users assigned</p>
                  ) : (
                    assignedUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">@{user.username}</p>
                        </div>
                        <button
                          onClick={() => handleUnassignUser(user.id)}
                          disabled={assigning}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          title="Unassign User"
                        >
                          <UserMinus className="h-5 w-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Item Selection Modal Component
const ItemSelectionModal = ({ session, onClose, onSave }) => {
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (session) {
      fetchItems();
    }
  }, [session]);

  const fetchItems = async () => {
    try {
      setLoading(true);

      // Fetch all items
      const { data: allItems, error: itemsError } = await supabase
        .from('items')
        .select('id, sku, item_code, item_name, category, tags')
        .order('item_name');

      if (itemsError) throw itemsError;

      // Fetch currently selected items
      const { data: selected, error: selectedError } = await supabase
        .from('session_items')
        .select('item_id')
        .eq('session_id', session.id);

      if (selectedError) throw selectedError;

      const selectedItemIds = new Set(selected.map(s => s.item_id));

      // Separate available and selected items
      const available = allItems.filter(item => !selectedItemIds.has(item.id));
      const selectedList = allItems.filter(item => selectedItemIds.has(item.id));

      setAvailableItems(available);
      setSelectedItems(selectedList);
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = async (itemId) => {
    try {
      setAssigning(true);
      const { error } = await supabase
        .from('session_items')
        .insert([{ session_id: session.id, item_id: itemId }]);

      if (error) throw error;

      await fetchItems();
    } catch (err) {
      console.error('Error selecting item:', err);
    } finally {
      setAssigning(false);
    }
  };

  const handleDeselectItem = async (itemId) => {
    try {
      setAssigning(true);
      const { error } = await supabase
        .from('session_items')
        .delete()
        .eq('session_id', session.id)
        .eq('item_id', itemId);

      if (error) throw error;

      await fetchItems();
    } catch (err) {
      console.error('Error deselecting item:', err);
    } finally {
      setAssigning(false);
    }
  };

  const handleAddAllFiltered = async () => {
    if (filteredAvailableItems.length === 0) return;

    try {
      setAssigning(true);
      const itemsToAdd = filteredAvailableItems.map(item => ({
        session_id: session.id,
        item_id: item.id
      }));

      const { error } = await supabase
        .from('session_items')
        .insert(itemsToAdd);

      if (error) throw error;

      await fetchItems();
    } catch (err) {
      console.error('Error adding all filtered items:', err);
    } finally {
      setAssigning(false);
    }
  };

  const filteredAvailableItems = availableItems.filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">
            Manage Items for Session: {session?.name}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Available Items */}
              <div>
                <h4 className="text-lg font-semibold mb-4 text-gray-700">Available Items</h4>
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddAllFiltered}
                    disabled={assigning || filteredAvailableItems.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add All ({filteredAvailableItems.length})</span>
                  </button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredAvailableItems.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      {searchTerm ? 'No items match your search' : 'No available items'}
                    </p>
                  ) : (
                    filteredAvailableItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{item.item_name}</p>
                          <p className="text-sm text-gray-500">
                            SKU: {item.sku} | Code: {item.item_code} | Category: {item.category}
                            {item.tags && item.tags.length > 0 && ` | Tags: ${item.tags.join(', ')}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleSelectItem(item.id)}
                          disabled={assigning}
                          className="text-green-600 hover:text-green-800 disabled:opacity-50"
                          title="Select Item"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Selected Items */}
              <div>
                <h4 className="text-lg font-semibold mb-4 text-gray-700">Selected Items ({selectedItems.length})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedItems.length === 0 ? (
                    <p className="text-gray-500 text-sm">No items selected</p>
                  ) : (
                    selectedItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{item.item_name}</p>
                          <p className="text-sm text-gray-500">
                            SKU: {item.sku} | Code: {item.item_code} | Category: {item.category}
                            {item.tags && item.tags.length > 0 && ` | Tags: ${item.tags.join(', ')}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeselectItem(item.id)}
                          disabled={assigning}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          title="Deselect Item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Placeholder components for editors
const SessionEditor = ({ session, onClose, onSave }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: session?.name || '',
    status: session?.status || 'draft'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const sessionData = {
        name: formData.name,
        status: formData.status
      };

      if (session) {
        // Update
        const { error } = await supabase
          .from('sessions')
          .update(sessionData)
          .eq('id', session.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('sessions')
          .insert([{
            ...sessionData,
            type: 'inventory',
            created_by: user.id
          }]);
        if (error) throw error;
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving session:', err);
      setError(err.message || 'Failed to save session');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">
            {session ? 'Edit Session' : 'Create New Session'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <p><strong>Note:</strong> User assignments and item selections for this session are managed separately after creation.</p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const ItemEditor = ({ item, categories, onClose, onSave }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    sku: item?.sku || '',
    item_code: item?.item_code || '',
    item_name: item?.item_name || '',
    category: item?.category || '',
    uom: item?.uom || '',
    tags: item?.tags?.join(', ') || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const itemData = {
        sku: formData.sku,
        item_code: formData.item_code,
        item_name: formData.item_name,
        category: formData.category,
        uom: formData.uom,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      if (item) {
        // Update
        const { error } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', item.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('items')
          .insert([{ ...itemData, created_by: user.id }]);
        if (error) throw error;
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving item:', err);
      setError(err.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">
          {item ? 'Edit Item' : 'Add New Item'}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU *
            </label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Code *
            </label>
            <input
              type="text"
              name="item_code"
              value={formData.item_code}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name *
            </label>
            <input
              type="text"
              name="item_name"
              value={formData.item_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              UOM *
            </label>
            <input
              type="text"
              name="uom"
              value={formData.uom}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UserEditor = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    role: user?.role || 'counter'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          username: formData.username,
          role: formData.role
        })
        .eq('id', user.id);

      if (error) throw error;

      onSave();
      onClose();
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-lg w-full max-w-md">
          <h3 className="text-lg font-bold mb-4">Add New User</h3>
          <p className="text-gray-600 mb-4">
            User creation is handled through the signup process. Only existing users can be edited.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Edit User</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username *
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="counter">Counter</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CategoryEditor = ({ category, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (category) {
        // Update
        const { error } = await supabase
          .from('categories')
          .update(formData)
          .eq('id', category.id);
        if (error) throw error;
      } else {
        // Create - but handled by CategoryForm
        throw new Error('Create not implemented here');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving category:', err);
      setError(err.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Edit Category</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const LocationEditor = ({ location, categories, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    category_id: location?.category_id || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (location) {
        // Update
        const { error } = await supabase
          .from('locations')
          .update(formData)
          .eq('id', location.id);
        if (error) throw error;
      } else {
        // Create - but handled by LocationForm
        throw new Error('Create not implemented here');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving location:', err);
      setError(err.message || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Edit Location</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;