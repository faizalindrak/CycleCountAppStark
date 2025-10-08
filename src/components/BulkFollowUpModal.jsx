import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const BulkFollowUpModal = ({ isOpen, onClose, onSubmit, selectedItems = [], reports = [] }) => {
  const [selectedStatus, setSelectedStatus] = useState('open');
  const [loading, setLoading] = useState(false);

  const statusOptions = [
    {
      value: 'open',
      label: 'Open',
      description: 'Issue has been reported and needs attention',
      icon: <AlertCircle className="h-5 w-5 text-blue-500" />,
      color: 'border-blue-200 bg-blue-50'
    },
    {
      value: 'on_progress',
      label: 'On Progress',
      description: 'Issue is being worked on',
      icon: <Clock className="h-5 w-5 text-yellow-500" />,
      color: 'border-yellow-200 bg-yellow-50'
    },
    {
      value: 'closed',
      label: 'Closed',
      description: 'Issue has been resolved',
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      color: 'border-green-200 bg-green-50'
    }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedStatus || selectedItems.length === 0) {
      return;
    }

    setLoading(true);
    await onSubmit(selectedStatus);
    setLoading(false);
  };

  const handleClose = () => {
    setSelectedStatus('open');
    onClose();
  };

  // Get selected item details for display
  const selectedItemDetails = reports.filter(report => selectedItems.includes(report.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h3 className="text-lg font-bold">Bulk Change Follow Up Status</h3>
            <p className="text-sm text-gray-600">{selectedItems.length} items selected</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Selected Items Preview */}
        <div className="p-6 border-b bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Selected Items:</h4>
          <div className="max-h-32 overflow-y-auto space-y-2">
            {selectedItemDetails.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{item.item_name}</span>
                <span className="text-gray-500">({item.sku})</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  item.follow_up_status === 'open' ? 'bg-blue-100 text-blue-800' :
                  item.follow_up_status === 'on_progress' ? 'bg-yellow-100 text-yellow-800' :
                  item.follow_up_status === 'closed' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {item.follow_up_status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select New Status <span className="text-red-500">*</span>
            </label>

            <div className="space-y-3">
              {statusOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedStatus === option.value
                      ? `${option.color} border-current`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="followUpStatus"
                    value={option.value}
                    checked={selectedStatus === option.value}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="mt-1 mr-3"
                  />

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {option.icon}
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <p className="text-sm text-gray-600">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedItems.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : `Update ${selectedItems.length} Items`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkFollowUpModal;