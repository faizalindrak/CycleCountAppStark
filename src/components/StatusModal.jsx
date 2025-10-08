import React, { useState, useEffect } from 'react';
import { X, Search, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

const StatusModal = ({ isOpen, onClose, onSubmit, statusType }) => {
  const [formData, setFormData] = useState({
    sku: '',
    internal_product_code: '',
    item_name: '',
    remarks: '',
    qty: ''
  });
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState('');
  const [errors, setErrors] = useState({});

  // Fetch items when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure reset happens first
      setTimeout(() => {
        fetchItems();
      }, 100);
    }
  }, [isOpen]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Auto-reset all states when modal opens to prevent stuck states
      resetModalState();

      // Also reset form data
      setFormData({
        sku: '',
        internal_product_code: '',
        item_name: '',
        remarks: '',
        qty: ''
      });
    }
  }, [isOpen]);

  const fetchItems = async () => {
    try {
      setItemsLoading(true);
      setItemsError('');

      console.log('Fetching items from database...');
      const { data, error } = await supabase
        .from('items')
        .select('id, sku, item_code, item_name, internal_product_code')
        .order('item_name');

      if (error) {
        console.error('Supabase error fetching items:', error);
        throw error;
      }

      console.log('Items fetched successfully:', data?.length || 0, 'items');
      setItems(data || []);
      setFilteredItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      setItemsError('Failed to load items. Please check your connection and try again.');
      setItems([]);
      setFilteredItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    if (term.trim() === '') {
      setFilteredItems(items);
    } else {
      const filtered = items.filter(item =>
        item.item_name.toLowerCase().includes(term.toLowerCase()) ||
        item.sku.toLowerCase().includes(term.toLowerCase()) ||
        (item.internal_product_code && item.internal_product_code.toLowerCase().includes(term.toLowerCase()))
      );
      setFilteredItems(filtered);
    }
  };

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    setFormData({
      sku: item.sku,
      internal_product_code: item.internal_product_code || '',
      item_name: item.item_name,
      remarks: '',
      qty: ''
    });
    setSearchTerm(item.item_name);
    setFilteredItems([]);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!selectedItem) {
      newErrors.item = 'Please select an item';
    }

    console.log('Form validation - selectedItem:', selectedItem, 'errors:', newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submitted, selectedItem:', selectedItem);

    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    console.log('Form validation passed, setting loading to true');
    setLoading(true);

    // Set a timeout to reset loading state as a fallback
    const loadingTimeout = setTimeout(() => {
      console.log('Loading timeout reached, resetting loading state');
      setLoading(false);
    }, 10000); // 10 second timeout

    try {
      const submitData = {
        ...formData,
        qty: formData.qty ? parseInt(formData.qty) : null
      };

      console.log('Submitting data:', submitData);
      await onSubmit(submitData);
      console.log('Submit successful');
      clearTimeout(loadingTimeout);
      // Success - modal will be closed by parent component
    } catch (error) {
      console.error('Error submitting form:', error);
      clearTimeout(loadingTimeout);
      // Keep modal open and reset loading state on error
      setLoading(false);
    }
  };


  // Add a reset function to fix state issues
  const resetModalState = () => {
    console.log('Resetting modal state');
    setLoading(false);
    setItemsLoading(true); // Show loading while resetting
    setItemsError('');
    setErrors({});
    setSelectedItem(null);
    setSearchTerm('');
    setItems([]);
    setFilteredItems([]);

    // Reset to not loading after a brief moment
    setTimeout(() => {
      setItemsLoading(false);
    }, 200);
  };

  const handleClose = () => {
    setFormData({
      sku: '',
      internal_product_code: '',
      item_name: '',
      remarks: '',
      qty: ''
    });
    setSelectedItem(null);
    setSearchTerm('');
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-bold flex items-center gap-2">
            {statusType === 'kritis' ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : (
              <TrendingUp className="h-5 w-5 text-orange-500" />
            )}
            Add Status {statusType === 'kritis' ? 'Kritis' : 'Over'}
          </h3>
          <div className="flex items-center gap-2">
            {!itemsLoading && !itemsError && (
              <button
                type="button"
                onClick={fetchItems}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Refresh items"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Item Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item <span className="text-red-500">*</span>
            </label>

            {itemsLoading ? (
              <div className="flex items-center justify-center p-4 border border-gray-300 rounded-md">
                <div className="text-sm text-gray-600">Loading items...</div>
              </div>
            ) : itemsError ? (
              <div className="p-4 border border-red-300 rounded-md bg-red-50">
                <div className="text-sm text-red-600 mb-2">{itemsError}</div>
                <button
                  type="button"
                  onClick={fetchItems}
                  className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center border border-gray-300 rounded-md">
                  <Search className="h-4 w-4 text-gray-400 ml-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search items by name, SKU, or product code..."
                    className="flex-1 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Dropdown */}
                {filteredItems.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleItemSelect(item)}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-gray-500">
                          SKU: {item.sku} {item.internal_product_code && `| Code: ${item.internal_product_code}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchTerm && filteredItems.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
                    <div className="text-sm text-gray-500">No items found matching "{searchTerm}"</div>
                  </div>
                )}
              </div>
            )}

            {errors.item && <p className="mt-1 text-sm text-red-600">{errors.item}</p>}
          </div>

          {/* Selected Item Info */}
          {selectedItem && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="text-sm">
                <div><strong>Selected Item:</strong> {selectedItem.item_name}</div>
                <div><strong>SKU:</strong> {selectedItem.sku}</div>
                {selectedItem.internal_product_code && (
                  <div><strong>Product Code:</strong> {selectedItem.internal_product_code}</div>
                )}
              </div>
            </div>
          )}

          {/* Status - Read Only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-md">
              {statusType === 'kritis' ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingUp className="h-4 w-4 text-orange-500" />
              )}
              <span className={`font-medium ${statusType === 'kritis' ? 'text-red-600' : 'text-orange-600'}`}>
                {statusType === 'kritis' ? 'Kritis' : 'Over'}
              </span>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="number"
              min="1"
              value={formData.qty}
              onChange={(e) => handleInputChange('qty', e.target.value)}
              placeholder="Enter quantity"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                errors.qty
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.qty && <p className="mt-1 text-sm text-red-600">{errors.qty}</p>}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks <span className="text-gray-500">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={formData.remarks}
              onChange={(e) => handleInputChange('remarks', e.target.value)}
              placeholder="Add any additional remarks..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={resetModalState}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
              title="Reset modal state"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={loading || !selectedItem}
              className={`px-4 py-2 rounded-md text-white ${
                statusType === 'kritis'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              } disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
              title={!selectedItem ? 'Please select an item first' : loading ? 'Saving...' : 'Save report'}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StatusModal;