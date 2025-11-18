import React, { useState } from 'react';
import { X, AlertTriangle, TrendingUp, Clock, CheckCircle, Edit } from 'lucide-react';
import FollowUpModal from './FollowUpModal';

const KanbanCardModal = ({ isOpen, onClose, item, onStatusUpdate, getStatusIcon, getFollowUpIcon }) => {
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  if (!isOpen || !item) return null;

  const handleFollowUpClick = () => {
    setIsFollowUpModalOpen(true);
  };

  const handleFollowUpSubmit = async (newStatus) => {
    await onStatusUpdate(item.id, newStatus);
    setIsFollowUpModalOpen(false);
  };

  const handleClose = () => {
    setIsFollowUpModalOpen(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b">
            <div className="flex items-center gap-3">
              {getStatusIcon(item.inventory_status)}
              <h3 className="text-lg font-bold text-gray-900">{item.item_name}</h3>
              {getFollowUpIcon(item.follow_up_status)}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Basic Information */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Basic Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">SKU:</span>
                    <span className="font-medium">{item.sku}</span>
                  </div>
                  {item.internal_product_code && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Internal Code:</span>
                      <span className="font-medium">{item.internal_product_code}</span>
                    </div>
                  )}
                  {item.qty && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quantity:</span>
                      <span className="font-medium">{item.qty}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date:</span>
                    <span className="font-medium">{new Date(item.date_input).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Inventory Status:</span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(item.inventory_status)}
                      <span className="font-medium capitalize">{item.inventory_status?.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Follow Up Status:</span>
                    <div className="flex items-center gap-1">
                      {getFollowUpIcon(item.follow_up_status)}
                      <span className="font-medium capitalize">{item.follow_up_status?.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Information */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">User Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reported By:</span>
                    <span className="font-medium">{item.user_report_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Updated By:</span>
                    <span className="font-medium">{item.user_follow_up_name || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks */}
            {item.remarks && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-2">Remarks</h4>
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
                  {item.remarks}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="mt-6 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Created:</span>
                  <div className="font-medium">
                    {new Date(item.created_at).toLocaleString('id-ID')}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Updated:</span>
                  <div className="font-medium">
                    {new Date(item.updated_at).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={handleFollowUpClick}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Change Follow Up Status
            </button>
          </div>
        </div>
      </div>

      {/* Follow Up Modal */}
      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        onSubmit={handleFollowUpSubmit}
        currentStatus={item.follow_up_status}
      />
    </>
  );
};

export default KanbanCardModal;