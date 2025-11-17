import React, { useState, useEffect } from 'react';
import { X, Search, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

const StatusModal = ({ isOpen, onClose, onSubmit, statusType, activeSkus = [], scannedItem = null }) => {
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
  const [selectedStatusType, setSelectedStatusType] = useState(statusType);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  // Load category from localStorage on mount
  useEffect(() => {
    const savedCategory = localStorage.getItem('selectedCategory');
    if (savedCategory) {
      setSelectedCategory(savedCategory);
    }
  }, []);

  // Save category to localStorage when it changes
  useEffect(() => {
    if (selectedCategory) {
      localStorage.setItem('selectedCategory', selectedCategory);
    }
  }, [selectedCategory]);

  // Fetch items when modal opens (skip if scannedItem is provided)
  useEffect(() => {
    if (isOpen && !scannedItem) {
      // Small delay to ensure reset happens first
      setTimeout(() => {
        fetchItems();
      }, 100);
    }
  }, [isOpen, scannedItem]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Auto-reset all states when modal opens to prevent stuck states
      resetModalState();

      // Set status type
      setSelectedStatusType(statusType);

      // If scannedItem is provided, set it as selected item
      if (scannedItem) {
        setSelectedItem(scannedItem);
        setFormData({
          sku: scannedItem.sku,
          internal_product_code: scannedItem.internal_product_code || '',
          item_name: scannedItem.item_name,
          remarks: '',
          qty: ''
        });
      } else {
        // Reset form data if no scanned item
        setFormData({
          sku: '',
          internal_product_code: '',
          item_name: '',
          remarks: '',
          qty: ''
        });
      }
    }
  }, [isOpen, scannedItem, statusType]);

  const fetchItems = async () => {
    try {
      setItemsLoading(true);
      setItemsError('');

      console.log('Fetching items from database...');
      console.log('Active SKUs to filter out (raw):', activeSkus);
      console.log('Active SKUs count:', activeSkus.length);

      // Fetch all items with pagination to bypass Supabase 1000 row limit
      let allItems = [];
      let start = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('items')
          .select('id, sku, item_code, item_name, internal_product_code, category')
          .order('item_name')
          .range(start, start + pageSize - 1);

        if (error) {
          console.error('Supabase error fetching items:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allItems = [...allItems, ...data];
          console.log(`Fetched batch: ${data.length} items (total so far: ${allItems.length})`);

          // If we got less than pageSize, we've reached the end
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            start += pageSize;
          }
        } else {
          hasMore = false;
        }
      }

      console.log('Items fetched successfully:', allItems.length, 'items (total)');

      // Extract unique categories from items
      const uniqueCategories = [...new Set(allItems.map(item => item.category).filter(Boolean))].sort();
      console.log('Unique categories found:', uniqueCategories);
      setCategories(uniqueCategories);

      // Filter out items with SKUs that are already active (open/on_progress)
      // Use case-insensitive and trimmed comparison to handle variations in SKU format
      const normalizedActiveSkus = activeSkus.map(sku => (sku || '').toString().trim().toLowerCase());
      console.log('Normalized active SKUs:', normalizedActiveSkus);

      const filteredOutItems = [];
      const availableItems = (allItems || []).filter(item => {
        const itemSku = (item.sku || '').toString().trim().toLowerCase();
        const isActive = normalizedActiveSkus.includes(itemSku);
        if (isActive) {
          filteredOutItems.push({ sku: item.sku, name: item.item_name });
        }
        return !isActive;
      });

      console.log('Items filtered out (already active):', filteredOutItems.length);
      if (filteredOutItems.length > 0) {
        console.log('Filtered items:', filteredOutItems);
      }
      console.log('Available items after filtering active SKUs:', availableItems.length, 'items');

      setItems(availableItems);
      applyFilters(availableItems, searchTerm, selectedCategory);
    } catch (error) {
      console.error('Error fetching items:', error);
      setItemsError('Failed to load items. Please check your connection and try again.');
      setItems([]);
      setFilteredItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  // Apply both category and search filters
  const applyFilters = (itemsList, search, category) => {
    let filtered = itemsList;

    // Filter by category if selected
    if (category) {
      filtered = filtered.filter(item => item.category === category);
    }

    // Filter by search term
    if (search && search.trim() !== '') {
      filtered = filtered.filter(item =>
        item.item_name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase()) ||
        (item.internal_product_code && item.internal_product_code.toLowerCase().includes(search.toLowerCase()))
      );
    }

    setFilteredItems(filtered);
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    applyFilters(items, term, selectedCategory);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    // Clear selected item when category changes
    setSelectedItem(null);
    setFormData({
      sku: '',
      internal_product_code: '',
      item_name: '',
      remarks: '',
      qty: ''
    });
    // Clear search and reapply filters
    setSearchTerm('');
    applyFilters(items, '', category);
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
    setSearchTerm(''); // Clear search term to hide dropdown
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
        qty: formData.qty !== '' ? parseInt(formData.qty) : null,
        inventory_status: selectedStatusType // Include the selected status type
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
            {scannedItem ? (
              <>
                <AlertTriangle className="h-5 w-5 text-blue-500" />
                Add Report - Scanned Item
              </>
            ) : (
              <>
                {selectedStatusType === 'kritis' ? (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                )}
                Add Status {selectedStatusType === 'kritis' ? 'Kritis' : 'Over'}
              </>
            )}
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
          {/* Category Selection - Only show if not scanned item */}
          {!scannedItem && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Kategori:
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={itemsLoading}
              >
                <option value="">Semua Kategori</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Item Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item <span className="text-red-500">*</span>
            </label>

            {/* Info about filtered active SKUs */}
            {activeSkus.length > 0 && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> SKUs yang sedang dalam status Open atau On Progress tidak ditampilkan di daftar ({activeSkus.length} SKU aktif)
                </p>
              </div>
            )}

            {scannedItem ? (
              // If item is from scan, just show the selected item
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="text-sm">
                  <div><strong>Scanned Item:</strong> {scannedItem.item_name}</div>
                  <div><strong>SKU:</strong> {scannedItem.sku}</div>
                  {scannedItem.internal_product_code && (
                    <div><strong>Product Code:</strong> {scannedItem.internal_product_code}</div>
                  )}
                </div>
              </div>
            ) : itemsLoading ? (
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

          {/* Selected Item Info - Only show if not scanned item (scanned item already shown above) */}
          {selectedItem && !scannedItem && (
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

          {/* Status - Editable if scanned, Read-only if manual */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status {scannedItem && <span className="text-red-500">*</span>}
            </label>
            {scannedItem ? (
              // Editable toggle for scanned items
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStatusType('kritis')}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md border-2 transition-all ${
                    selectedStatusType === 'kritis'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-red-300'
                  }`}
                >
                  <AlertTriangle className={`h-5 w-5 ${selectedStatusType === 'kritis' ? 'text-red-500' : 'text-gray-400'}`} />
                  <span className={`font-medium ${selectedStatusType === 'kritis' ? 'text-red-600' : 'text-gray-600'}`}>
                    Kritis
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusType('over')}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md border-2 transition-all ${
                    selectedStatusType === 'over'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-300 bg-white hover:border-orange-300'
                  }`}
                >
                  <TrendingUp className={`h-5 w-5 ${selectedStatusType === 'over' ? 'text-orange-500' : 'text-gray-400'}`} />
                  <span className={`font-medium ${selectedStatusType === 'over' ? 'text-orange-600' : 'text-gray-600'}`}>
                    Over
                  </span>
                </button>
              </div>
            ) : (
              // Read-only display for manual entry
              <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-md">
                {selectedStatusType === 'kritis' ? (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                )}
                <span className={`font-medium ${selectedStatusType === 'kritis' ? 'text-red-600' : 'text-orange-600'}`}>
                  {selectedStatusType === 'kritis' ? 'Kritis' : 'Over'}
                </span>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="number"
              min="0"
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
                selectedStatusType === 'kritis'
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