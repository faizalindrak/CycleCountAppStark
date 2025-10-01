import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  X,
  Plus,
  Check,
  Search,
  Filter,
  Edit3,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const TagManagement = ({ items, onTagsUpdated, session }) => {
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showTagModal, setShowTagModal] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [operation, setOperation] = useState('add'); // 'add' or 'remove'
  const [loading, setLoading] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const [notification, setNotification] = useState(null);

  // Extract all unique tags from items
  const allTags = useMemo(() => {
    const tagSet = new Set();
    items.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [items]);

  // Filter items by search term across multiple fields
  const filteredItems = useMemo(() => {
    if (!tagFilter) return items;

    const searchTerm = tagFilter.toLowerCase().trim();

    return items.filter(item => {
      // Search in SKU
      if (item.sku && item.sku.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in item code
      if (item.item_code && item.item_code.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in item name
      if (item.item_name && item.item_name.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in category
      if (item.category && item.category.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in tags
      if (item.tags && Array.isArray(item.tags)) {
        if (item.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
          return true;
        }
      }

      // Search in UOM
      if (item.uom && item.uom.toLowerCase().includes(searchTerm)) {
        return true;
      }

      return false;
    });
  }, [items, tagFilter]);

  // Get suggested tags based on search term
  const suggestedTags = useMemo(() => {
    if (!tagSearchTerm.trim()) return allTags;

    return allTags.filter(tag =>
      tag.toLowerCase().includes(tagSearchTerm.toLowerCase())
    );
  }, [allTags, tagSearchTerm]);

  // Handle item selection
  const handleItemSelect = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  // Handle tag operations
  const handleAddTag = (tag) => {
    setSelectedTags(prev => new Set([...prev, tag]));
  };

  const handleRemoveTag = (tag) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      newSet.delete(tag);
      return newSet;
    });
  };

  const handleCreateNewTag = () => {
    if (newTagName.trim() && !allTags.includes(newTagName.trim())) {
      handleAddTag(newTagName.trim());
      setNewTagName('');
    }
  };

  // Apply tag changes to selected items
  const applyTagChanges = async () => {
    if (selectedItems.size === 0 || selectedTags.size === 0) return;

    setLoading(true);
    try {
      const itemsToUpdate = items.filter(item => selectedItems.has(item.id));

      for (const item of itemsToUpdate) {
        let updatedTags = [...(item.tags || [])];

        if (operation === 'add') {
          // Add selected tags that don't already exist
          selectedTags.forEach(tag => {
            if (!updatedTags.includes(tag)) {
              updatedTags.push(tag);
            }
          });
        } else {
          // Remove selected tags
          updatedTags = updatedTags.filter(tag => !selectedTags.has(tag));
        }

        const { error } = await supabase
          .from('items')
          .update({ tags: updatedTags })
          .eq('id', item.id);

        if (error) {
          console.error('Error updating item tags:', error, {
            itemId: item.id,
            currentTags: item.tags,
            updatedTags: updatedTags
          });
          throw error;
        }

        console.log('Successfully updated tags for item:', item.id, {
          from: item.tags,
          to: updatedTags
        });
      }

      // Refresh the items data
      if (onTagsUpdated) {
        console.log('Calling onTagsUpdated callback to refresh data...');
        await onTagsUpdated();
      }

      // Also clear the cache to ensure fresh data on next load
      try {
        const cached = localStorage.getItem('adminDashboardData');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.timestamp = 0; // Force cache expiry
          localStorage.setItem('adminDashboardData', JSON.stringify(parsed));
          console.log('Marked cache as expired to force fresh data on reload');
        }
      } catch (e) {
        console.error('Error updating cache timestamp:', e);
      }

      // Reset state
      setSelectedItems(new Set());
      setSelectedTags(new Set());
      setShowTagModal(false);

      // Show success notification
      showNotification(
        `Successfully ${operation === 'add' ? 'added' : 'removed'} ${selectedTags.size} tag(s) from ${itemsToUpdate.length} item(s)`,
        'success'
      );

      console.log('Tag update completed successfully:', {
        operation,
        tagCount: selectedTags.size,
        itemCount: itemsToUpdate.length,
        tags: Array.from(selectedTags),
        items: itemsToUpdate.map(item => ({ id: item.id, sku: item.sku, name: item.item_name }))
      });
    } catch (error) {
      console.error('Error updating tags:', error);
      showNotification('Error updating tags: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Notification system
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="relative">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border max-w-sm transition-all duration-300 ${
          notification.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        {/* Two Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left Panel - Items Selection */}
        <div className="p-6 space-y-4 border-r border-gray-200">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h4 className="font-semibold text-gray-800">Select Items</h4>
            <div className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {selectedItems.size} selected
            </div>
          </div>

          {/* Items Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by SKU, item code, name, category, UOM, or tags..."
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Items List */}
          <div className="border rounded-lg max-h-96 overflow-y-auto bg-gray-50">
            <div className="p-3 border-b bg-white">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">Select All Visible</span>
              </label>
            </div>
            <div className="divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedItems.has(item.id) ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white'
                  }`}
                  onClick={() => handleItemSelect(item.id)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => handleItemSelect(item.id)}
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 text-sm">
                        <span className="font-semibold text-gray-900">{item.sku}</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-600 font-mono">{item.item_code}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-blue-600 font-medium">{item.category}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-green-600 font-medium">{item.uom}</span>
                      </div>
                      <h5 className="font-medium text-gray-900 mb-2 truncate">{item.item_name}</h5>

                      {/* Tags Display */}
                      <div className="flex flex-wrap gap-1">
                        {item.tags && item.tags.length > 0 ? (
                          item.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                            >
                              <Tag className="h-3 w-3" />
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">No tags</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Tag Management */}
        <div className="p-6 space-y-4">
          <div className="pb-4 border-b border-gray-100">
            <h4 className="font-semibold text-gray-800 mb-2">Manage Tags</h4>
            <p className="text-sm text-gray-600">
              {selectedItems.size > 0
                ? `Managing tags for ${selectedItems.size} selected item(s)`
                : 'Select items from the left panel to manage their tags'
              }
            </p>
          </div>

          {/* Quick Actions */}
          {selectedItems.size > 0 && (
            <div className="flex gap-2 p-4 bg-gray-50 rounded-lg">
              <button
                onClick={() => {
                  setOperation('add');
                  setShowTagModal(true);
                }}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Tags
              </button>
              <button
                onClick={() => {
                  setOperation('remove');
                  setShowTagModal(true);
                }}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
              >
                <X className="h-4 w-4" />
                Remove Tags
              </button>
            </div>
          )}

          {/* Tag Statistics */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-3">Statistics</h5>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white p-2 rounded border">
                <span className="text-gray-600 block">Total Items:</span>
                <span className="font-semibold text-lg">{items.length}</span>
              </div>
              <div className="bg-white p-2 rounded border">
                <span className="text-gray-600 block">Items with Tags:</span>
                <span className="font-semibold text-lg text-blue-600">
                  {items.filter(item => item.tags && item.tags.length > 0).length}
                </span>
              </div>
              <div className="bg-white p-2 rounded border">
                <span className="text-gray-600 block">Unique Tags:</span>
                <span className="font-semibold text-lg text-green-600">{allTags.length}</span>
              </div>
              <div className="bg-white p-2 rounded border">
                <span className="text-gray-600 block">Selected:</span>
                <span className="font-semibold text-lg text-purple-600">{selectedItems.size}</span>
              </div>
            </div>
          </div>

          {/* Selected Items Preview */}
          {selectedItems.size > 0 && (
            <div className="p-4 border rounded-lg bg-blue-50">
              <h5 className="font-medium text-gray-800 mb-3">Selected Items Preview:</h5>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {Array.from(selectedItems).slice(0, 5).map(itemId => {
                  const item = items.find(i => i.id === itemId);
                  return item ? (
                    <div key={itemId} className="text-sm text-gray-700 flex items-center gap-2 p-2 bg-white rounded border">
                      <span className="font-semibold text-gray-900">{item.sku}</span>
                      <span className="text-gray-400">•</span>
                      <span className="truncate flex-1">{item.item_name}</span>
                      <div className="flex gap-1">
                        {item.tags && item.tags.length > 0 ? (
                          item.tags.slice(0, 2).map((tag, index) => (
                            <span key={index} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">No tags</span>
                        )}
                        {item.tags && item.tags.length > 2 && (
                          <span className="text-xs text-gray-400">+{item.tags.length - 2}</span>
                        )}
                      </div>
                    </div>
                  ) : null;
                })}
                {selectedItems.size > 5 && (
                  <div className="text-sm text-gray-500 bg-white p-2 rounded border text-center">
                    ... and {selectedItems.size - 5} more items selected
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions when no items selected */}
          {selectedItems.size === 0 && (
            <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
              <Tag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium mb-1">No items selected</p>
              <p className="text-sm">Choose items from the left panel to start managing tags</p>
            </div>
          )}
        </div>
      </div>

      {/* Tag Management Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {operation === 'add' ? 'Add Tags' : 'Remove Tags'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {operation === 'add' ? 'Adding' : 'Removing'} tags from {selectedItems.size} selected item(s)
                </p>
              </div>
              <button
                onClick={() => setShowTagModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Side - Tag Selection */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Select Tags</h4>

                  {/* Selected Tags Display */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {operation === 'add' ? 'Tags to Add:' : 'Tags to Remove:'}
                    </label>
                    <div className="flex flex-wrap gap-2 min-h-[60px] p-3 border border-gray-300 rounded-md">
                      {selectedTags.size === 0 ? (
                        <span className="text-gray-400 text-sm">No tags selected</span>
                      ) : (
                        Array.from(selectedTags).map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Tag Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Existing Tags:
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        placeholder="Search existing tags..."
                        value={tagSearchTerm}
                        onChange={(e) => setTagSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Suggested Tags */}
                    {suggestedTags.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                        {suggestedTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => handleAddTag(tag)}
                            disabled={selectedTags.has(tag)}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 ${
                              selectedTags.has(tag) ? 'bg-gray-100 text-gray-400' : 'text-gray-700'
                            }`}
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                            {selectedTags.has(tag) && <Check className="h-3 w-3 text-green-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Create New Tag */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Create New Tag:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter new tag name..."
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateNewTag()}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleCreateNewTag}
                        disabled={!newTagName.trim() || allTags.includes(newTagName.trim())}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Create
                      </button>
                    </div>
                    {newTagName.trim() && allTags.includes(newTagName.trim()) && (
                      <p className="text-sm text-red-600 mt-1">Tag already exists</p>
                    )}
                  </div>
                </div>

                {/* Right Side - Preview and Action */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Preview & Apply</h4>

                  {/* Changes Preview */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h5 className="font-medium text-gray-900 mb-2">Changes Preview:</h5>
                    <p className="text-sm text-gray-600 mb-2">
                      {operation === 'add' ? 'Adding' : 'Removing'} {selectedTags.size} tag(s) from {selectedItems.size} item(s)
                    </p>

                    {selectedTags.size > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Tags:</p>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(selectedTags).map(tag => (
                            <span key={tag} className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedItems.size > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Items:</p>
                        <div className="max-h-24 overflow-y-auto text-xs text-gray-600">
                          {Array.from(selectedItems).slice(0, 3).map(itemId => {
                            const item = items.find(i => i.id === itemId);
                            return item ? (
                              <div key={itemId} className="mb-1">
                                {item.sku} - {item.item_name}
                              </div>
                            ) : null;
                          })}
                          {selectedItems.size > 3 && (
                            <div className="text-gray-500">
                              ... and {selectedItems.size - 3} more items
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowTagModal(false)}
                className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={applyTagChanges}
                disabled={selectedItems.size === 0 || selectedTags.size === 0 || loading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2 font-medium transition-colors shadow-sm"
              >
                {loading ? (
                  <div className="spinner w-4 h-4"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {operation === 'add' ? 'Add Tags' : 'Remove Tags'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default TagManagement;