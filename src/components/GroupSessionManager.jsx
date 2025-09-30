import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  Package,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  UserPlus,
  PackagePlus,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const GroupSessionManager = ({ session, onClose, onDataChange }) => {
  const { user } = useAuth();
  const [groupSessions, setGroupSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showEditor, setShowEditor] = useState(false);
  const [showUserAssignment, setShowUserAssignment] = useState(false);
  const [showItemAssignment, setShowItemAssignment] = useState(false);
  const [editingGroupSession, setEditingGroupSession] = useState(null);
  const [selectedGroupSessionForUsers, setSelectedGroupSessionForUsers] = useState(null);
  const [selectedGroupSessionForItems, setSelectedGroupSessionForItems] = useState(null);

  useEffect(() => {
    if (session) {
      fetchGroupSessions();
    }
  }, [session]);

  const fetchGroupSessions = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('group_sessions')
        .select(`
          *,
          group_session_users(count),
          group_session_items(count)
        `)
        .eq('session_id', session.id)
        .eq('is_active', true)
        .order('created_date');

      if (error) throw error;

      setGroupSessions(data || []);
    } catch (err) {
      console.error('Error fetching group sessions:', err);
      setError('Failed to load group sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroupSession = () => {
    setEditingGroupSession(null);
    setShowEditor(true);
  };

  const handleEditGroupSession = (groupSession) => {
    setEditingGroupSession(groupSession);
    setShowEditor(true);
  };

  const handleDeleteGroupSession = async (groupSessionId) => {
    if (!window.confirm('Are you sure you want to delete this group session? All assignments will be lost.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('group_sessions')
        .update({ is_active: false })
        .eq('id', groupSessionId);

      if (error) throw error;

      await fetchGroupSessions();
      await onDataChange();
    } catch (err) {
      console.error('Error deleting group session:', err);
      alert('Error deleting group session: ' + err.message);
    }
  };

  const handleManageUsers = (groupSession) => {
    setSelectedGroupSessionForUsers(groupSession);
    setShowUserAssignment(true);
  };

  const handleManageItems = (groupSession) => {
    setSelectedGroupSessionForItems(groupSession);
    setShowItemAssignment(true);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-center py-8">
            <div className="spinner"></div>
            <span className="ml-2 text-gray-600">Loading group sessions...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">
            Manage Group Sessions - {session?.name}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCreateGroupSession}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Group Session</span>
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-6 flex items-center p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              <AlertCircle className="h-4 w-4 mr-2" />
              {error}
            </div>
          )}

          {groupSessions.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No group sessions created yet.</p>
              <button
                onClick={handleCreateGroupSession}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Create First Group Session</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupSessions.map((groupSession) => (
                <div key={groupSession.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {groupSession.name}
                      </h4>
                      {groupSession.description && (
                        <p className="text-sm text-gray-600 mb-2">
                          {groupSession.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {groupSession.group_session_users?.[0]?.count || 0} users
                        </span>
                        <span className="flex items-center">
                          <Package className="h-3 w-3 mr-1" />
                          {groupSession.group_session_items?.[0]?.count || 0} items
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      groupSession.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {groupSession.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleManageUsers(groupSession)}
                        className="text-blue-600 hover:text-blue-800 p-2"
                        title="Manage Users"
                      >
                        <Users className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleManageItems(groupSession)}
                        className="text-green-600 hover:text-green-800 p-2"
                        title="Manage Items"
                      >
                        <Package className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditGroupSession(groupSession)}
                        className="text-indigo-600 hover:text-indigo-800 p-2"
                        title="Edit Group Session"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroupSession(groupSession.id)}
                        className="text-red-600 hover:text-red-800 p-2"
                        title="Delete Group Session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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

        {/* Modals */}
        {showEditor && (
          <GroupSessionEditor
            groupSession={editingGroupSession}
            session={session}
            onClose={() => {
              setShowEditor(false);
              setEditingGroupSession(null);
            }}
            onSave={async () => {
              await fetchGroupSessions();
              await onDataChange();
              setShowEditor(false);
              setEditingGroupSession(null);
            }}
          />
        )}

        {showUserAssignment && (
          <GroupSessionUserAssignmentModal
            groupSession={selectedGroupSessionForUsers}
            session={session}
            onClose={() => {
              setShowUserAssignment(false);
              setSelectedGroupSessionForUsers(null);
              fetchGroupSessions();
            }}
            onSave={onDataChange}
          />
        )}

        {showItemAssignment && (
          <GroupSessionItemAssignmentModal
            groupSession={selectedGroupSessionForItems}
            session={session}
            onClose={() => {
              setShowItemAssignment(false);
              setSelectedGroupSessionForItems(null);
              fetchGroupSessions();
            }}
            onSave={onDataChange}
          />
        )}
      </div>
    </div>
  );
};

// Group Session Editor Modal
const GroupSessionEditor = ({ groupSession, session, onClose, onSave }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: groupSession?.name || '',
    description: groupSession?.description || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const groupSessionData = {
        name: formData.name,
        description: formData.description,
        session_id: session.id,
        created_by: user.id
      };

      if (groupSession) {
        // Update
        const { error } = await supabase
          .from('group_sessions')
          .update(groupSessionData)
          .eq('id', groupSession.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('group_sessions')
          .insert([groupSessionData]);
        if (error) throw error;
      }

      onSave();
    } catch (err) {
      console.error('Error saving group session:', err);
      setError(err.message || 'Failed to save group session');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg w-full max-w-md flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">
            {groupSession ? 'Edit Group Session' : 'Create Group Session'}
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
                Group Session Name *
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
                placeholder="Optional description..."
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
    </div>
  );
};

// Group Session User Assignment Modal
const GroupSessionUserAssignmentModal = ({ groupSession, session, onClose, onSave }) => {
  const [availableUsers, setAvailableUsers] = useState([]);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (groupSession) {
      fetchUsers();
    }
  }, [groupSession]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Fetch all users assigned to the parent session
      const { data: sessionUsers, error: sessionUsersError } = await supabase
        .from('session_users')
        .select('user_id')
        .eq('session_id', session.id);

      if (sessionUsersError) throw sessionUsersError;

      const sessionUserIds = sessionUsers.map(su => su.user_id);

      if (sessionUserIds.length > 0) {
        // Fetch user profiles
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('id, name, username')
          .in('id', sessionUserIds)
          .order('name');

        if (usersError) throw usersError;

        // Fetch currently assigned users to this group session
        const { data: assigned, error: assignedError } = await supabase
          .from('group_session_users')
          .select('user_id')
          .eq('group_session_id', groupSession.id);

        if (assignedError) throw assignedError;

        const assignedUserIds = new Set(assigned.map(a => a.user_id));

        // Separate available and assigned users
        const available = users.filter(user => !assignedUserIds.has(user.id));
        const assignedList = users.filter(user => assignedUserIds.has(user.id));

        setAvailableUsers(available);
        setAssignedUsers(assignedList);
      } else {
        setAvailableUsers([]);
        setAssignedUsers([]);
      }
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
        .from('group_session_users')
        .insert([{
          group_session_id: groupSession.id,
          user_id: userId,
          assigned_by: (await supabase.auth.getUser()).data.user.id
        }]);

      if (error) throw error;

      // Update state
      const userToMove = availableUsers.find(user => user.id === userId);
      if (userToMove) {
        setAvailableUsers(prev => prev.filter(user => user.id !== userId));
        setAssignedUsers(prev => [...prev, userToMove].sort((a, b) => a.name.localeCompare(b.name)));
      }
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
        .from('group_session_users')
        .delete()
        .eq('group_session_id', groupSession.id)
        .eq('user_id', userId);

      if (error) throw error;

      // Update state
      const userToMove = assignedUsers.find(user => user.id === userId);
      if (userToMove) {
        setAssignedUsers(prev => prev.filter(user => user.id !== userId));
        setAvailableUsers(prev => [...prev, userToMove].sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) {
      console.error('Error unassigning user:', err);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">
            Manage Users for Group Session: {groupSession?.name}
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

// Group Session Item Assignment Modal
const GroupSessionItemAssignmentModal = ({ groupSession, session, onClose, onSave }) => {
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (groupSession) {
      fetchItems();
    }
  }, [groupSession]);

  const fetchItems = async () => {
    try {
      setLoading(true);

      // Fetch all items assigned to the parent session
      const { data: sessionItems, error: sessionItemsError } = await supabase
        .from('session_items')
        .select('item_id')
        .eq('session_id', session.id);

      if (sessionItemsError) throw sessionItemsError;

      const sessionItemIds = sessionItems.map(si => si.item_id);

      if (sessionItemIds.length > 0) {
        // Fetch item details
        const { data: items, error: itemsError } = await supabase
          .from('items')
          .select('id, sku, item_code, item_name, category, tags')
          .in('id', sessionItemIds)
          .order('item_name');

        if (itemsError) throw itemsError;

        // Fetch currently selected items for this group session
        const { data: selected, error: selectedError } = await supabase
          .from('group_session_items')
          .select('item_id')
          .eq('group_session_id', groupSession.id);

        if (selectedError) throw selectedError;

        const selectedItemIds = new Set(selected.map(s => s.item_id));

        // Separate available and selected items
        const available = items.filter(item => !selectedItemIds.has(item.id));
        const selectedList = items.filter(item => selectedItemIds.has(item.id));

        setAvailableItems(available);
        setSelectedItems(selectedList);
      } else {
        setAvailableItems([]);
        setSelectedItems([]);
      }
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
        .from('group_session_items')
        .insert([{
          group_session_id: groupSession.id,
          item_id: itemId,
          assigned_by: (await supabase.auth.getUser()).data.user.id
        }]);

      if (error) throw error;

      // Update state
      const itemToMove = availableItems.find(item => item.id === itemId);
      if (itemToMove) {
        setAvailableItems(prev => prev.filter(item => item.id !== itemId));
        setSelectedItems(prev => [...prev, itemToMove]);
      }
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
        .from('group_session_items')
        .delete()
        .eq('group_session_id', groupSession.id)
        .eq('item_id', itemId);

      if (error) throw error;

      // Update state
      const itemToMove = selectedItems.find(item => item.id === itemId);
      if (itemToMove) {
        setSelectedItems(prev => prev.filter(item => item.id !== itemId));
        setAvailableItems(prev => [...prev, itemToMove].sort((a, b) => a.item_name.localeCompare(b.item_name)));
      }
    } catch (err) {
      console.error('Error deselecting item:', err);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">
            Manage Items for Group Session: {groupSession?.name}
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
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                          <PackagePlus className="h-5 w-5" />
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

export default GroupSessionManager;