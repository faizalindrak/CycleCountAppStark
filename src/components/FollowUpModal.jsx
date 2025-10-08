import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const FollowUpModal = ({ isOpen, onClose, onSubmit, currentStatus }) => {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus || 'open');
  const [loading, setLoading] = useState(false);

  // Update selected status when currentStatus changes
  useEffect(() => {
    if (currentStatus) {
      setSelectedStatus(currentStatus);
    }
  }, [currentStatus]);

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

    if (!selectedStatus) {
      return;
    }

    setLoading(true);
    await onSubmit(selectedStatus);
    setLoading(false);
  };

  const handleClose = () => {
    setSelectedStatus(currentStatus || 'open');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-bold">Change Follow Up Status</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
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

          {/* Current Status Info */}
          <div className="mb-6 p-3 bg-gray-50 rounded-md">
            <div className="text-sm">
              <span className="font-medium">Current Status: </span>
              <span className={`inline-flex items-center gap-1 ${
                currentStatus === 'open' ? 'text-blue-600' :
                currentStatus === 'on_progress' ? 'text-yellow-600' :
                currentStatus === 'closed' ? 'text-green-600' : 'text-gray-600'
              }`}>
                {currentStatus === 'open' && <AlertCircle className="h-4 w-4" />}
                {currentStatus === 'on_progress' && <Clock className="h-4 w-4" />}
                {currentStatus === 'closed' && <CheckCircle className="h-4 w-4" />}
                {currentStatus === 'open' ? 'Open' :
                 currentStatus === 'on_progress' ? 'On Progress' :
                 currentStatus === 'closed' ? 'Closed' : 'Unknown'}
              </span>
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
              disabled={loading || selectedStatus === currentStatus}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FollowUpModal;