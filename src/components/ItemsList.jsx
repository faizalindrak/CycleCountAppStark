import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Search,
  QrCode,
  ChevronLeft,
  LogOut,
  CheckCircle,
  XCircle,
  MapPin,
  Package,
  Save,
  X,
  Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const ItemsList = ({ session, onBack }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCountModal, setShowCountModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [countLocation, setCountLocation] = useState('');
  const [countQuantity, setCountQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      fetchSessionData();
      subscribeToCounts();
    }
  }, [session]);

  const fetchSessionData = async () => {
    try {
      setLoading(true);

      // Fetch session items with item details
      const { data: sessionItems, error: sessionItemsError } = await supabase
        .from('session_items')
        .select(`
          items (
            id,
            sku,
            item_code,
            item_name,
            uom,
            category,
            tags
          )
        `)
        .eq('session_id', session.id);

      if (sessionItemsError) throw sessionItemsError;

      const itemsData = sessionItems.map(si => si.items).filter(Boolean);
      setItems(itemsData);

      // Fetch existing counts for this session
      const { data: countsData, error: countsError } = await supabase
        .from('counts')
        .select(`
          *,
          items (
            id,
            item_name,
            sku
          ),
          locations (
            name
          )
        `)
        .eq('session_id', session.id);

      if (countsError) throw countsError;

      // Group counts by item_id
      const countsByItem = {};
      countsData.forEach(count => {
        if (!countsByItem[count.item_id]) {
          countsByItem[count.item_id] = [];
        }
        countsByItem[count.item_id].push({
          location: count.locations?.name || 'Unknown',
          countedQty: count.counted_qty,
          timestamp: count.timestamp,
          id: count.id
        });
      });
      setCounts(countsByItem);

      // Fetch locations for the categories in this session
      const categories = [...new Set(itemsData.map(item => item.category))];
      if (categories.length > 0) {
        const { data: locationsData, error: locationsError } = await supabase
          .from('locations')
          .select('*')
          .in('category_id', categories.map(cat => {
            // This would need a join with categories table
            // For now, we'll fetch all locations
            return null;
          }).filter(Boolean));

        if (!locationsError) {
          setLocations(locationsData || []);
        }
      }
    } catch (err) {
      console.error('Error fetching session data:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToCounts = () => {
    const subscription = supabase
      .channel(`counts:${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'counts',
          filter: `session_id=eq.${session.id}`
        },
        (payload) => {
          console.log('Count change received:', payload);
          fetchSessionData(); // Refetch data when counts change
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch =
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_code.toLowerCase().includes(searchTerm.toLowerCase());

      const itemCounts = counts[item.id] || [];
      const isCounted = itemCounts.length > 0;

      if (filterStatus === 'counted') return matchesSearch && isCounted;
      if (filterStatus === 'uncounted') return matchesSearch && !isCounted;
      return matchesSearch;
    });
  }, [items, searchTerm, filterStatus, counts]);

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    // Set default location if available
    const itemLocations = locations.filter(loc =>
      // This would need proper category matching
      true // Simplified for now
    );
    setCountLocation(itemLocations[0]?.name || '');
    setCountQuantity('');
    setShowCountModal(true);
  };

  const handleSaveCount = async () => {
    if (!selectedItem || !countLocation || !countQuantity) {
      return;
    }

    try {
      setSubmitting(true);

      // Get location ID
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('name', countLocation)
        .single();

      if (locationError) throw locationError;

      // Insert count
      const { error: countError } = await supabase
        .from('counts')
        .insert({
          session_id: session.id,
          item_id: selectedItem.id,
          user_id: user.id,
          location_id: locationData.id,
          counted_qty: parseInt(countQuantity)
        });

      if (countError) throw countError;

      setShowCountModal(false);
      setCountQuantity('');
      setSelectedItem(null);
    } catch (err) {
      console.error('Error saving count:', err);
      alert('Error saving count: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const exportReport = async () => {
    try {
      const csvContent = "data:text/csv;charset=utf-8,Session,SKU,Item Name,Location,Counted Qty,Timestamp\n";

      const reportData = items.map(item => {
        const itemCounts = counts[item.id] || [];
        return itemCounts.map(count => ({
          sessionName: session.name,
          sku: item.sku,
          itemName: item.item_name,
          location: count.location,
          quantity: count.countedQty,
          timestamp: new Date(count.timestamp).toLocaleString()
        }));
      }).flat();

      const csvRows = reportData.map(row =>
        `${row.sessionName},"${row.sku}","${row.itemName}",${row.location},${row.quantity},"${row.timestamp}"`
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
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={onBack}
                  className="text-gray-600 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 truncate">
                    {session.name}
                  </h1>
                  <p className="text-gray-600 text-sm">
                    Loading items...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="text-gray-600 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {session.name}
                </h1>
                <p className="text-gray-600 text-sm">
                  Items: {filteredItems.length} of {items.length}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={exportReport}
                className="text-blue-600 hover:text-blue-800 p-2"
                title="Export Report"
              >
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Search and Filter Bar */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search SKU, name, or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Items</option>
                <option value="counted">Counted</option>
                <option value="uncounted">Uncounted</option>
              </select>
              <button
                onClick={() => {
                  // Mock QR scan functionality
                  const uncountedItems = filteredItems.filter(item =>
                    !counts[item.id] || counts[item.id].length === 0
                  );
                  if (uncountedItems.length > 0) {
                    handleItemSelect(uncountedItems[0]);
                  } else {
                    alert('All items have been counted!');
                  }
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
              >
                <QrCode className="h-4 w-4" />
                <span>Scan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Items Grid */}
        <div className="grid gap-4">
          {filteredItems.map((item) => {
            const itemCounts = counts[item.id] || [];
            const isCounted = itemCounts.length > 0;
            const totalCounted = itemCounts.reduce((acc, curr) => acc + curr.countedQty, 0);

            return (
              <div
                key={item.id}
                onClick={() => handleItemSelect(item)}
                className={`bg-white p-4 rounded-lg shadow hover:shadow-md cursor-pointer transition-all ${
                  isCounted ? 'border-l-4 border-green-500' : 'border-l-4 border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-semibold text-gray-900">{item.sku}</span>
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-600">{item.item_code}</span>
                      {isCounted ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {item.item_name}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                      <span>UOM: {item.uom}</span>
                      <span>Category: {item.category}</span>
                    </div>
                    {isCounted && (
                      <div className="mt-2 border-t pt-2">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-semibold text-sm text-gray-700">
                            Total Counted: {totalCounted} {item.uom}
                          </h4>
                        </div>
                        <ul className="space-y-1 text-sm">
                          {itemCounts.map((count, index) => (
                            <li key={index} className="flex items-center bg-gray-50 p-1.5 rounded">
                              <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                              <span className="font-medium text-gray-600">
                                {count.location}:
                              </span>
                              <span className="ml-2 text-green-700 font-bold">
                                {count.countedQty}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Count Modal */}
      {showCountModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Add Item Count</h3>
              <button
                onClick={() => setShowCountModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">SKU: {selectedItem.sku}</p>
              <p className="font-medium">{selectedItem.item_name}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <select
                  value={countLocation}
                  onChange={(e) => setCountLocation(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Location</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Quantity
                </label>
                <input
                  type="number"
                  value={countQuantity}
                  onChange={(e) => setCountQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowCountModal(false);
                  setCountQuantity('');
                  setSelectedItem(null);
                }}
                className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCount}
                disabled={!countLocation || !countQuantity || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center space-x-2"
              >
                {submitting ? (
                  <div className="spinner w-4 h-4"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Save Count</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsList;