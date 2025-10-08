import React from 'react';
import { AlertTriangle, TrendingUp, Clock, CheckCircle } from 'lucide-react';

const StatusList = ({ title, items, onFollowUpStatus, getStatusIcon, getFollowUpIcon, emptyMessage, selectedItems = [], onSelectionChange }) => {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-gray-400 mb-4">
          {title === 'Open Status' && <Clock className="h-12 w-12 mx-auto" />}
          {title === 'On Progress Status' && <Clock className="h-12 w-12 mx-auto" />}
          {title === 'Closed Status' && <CheckCircle className="h-12 w-12 mx-auto" />}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="divide-y divide-gray-200">
        {items.map((item) => (
          <div key={item.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelectionChange(item.id, e.target.checked);
                  }}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(item.inventory_status)}
                    <h4 className="text-base font-medium text-gray-900 truncate">{item.item_name}</h4>
                    {getFollowUpIcon(item.follow_up_status)}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span><strong>SKU:</strong> {item.sku}</span>
                    {item.internal_product_code && (
                      <span><strong>Code:</strong> {item.internal_product_code}</span>
                    )}
                    {item.qty && (
                      <span><strong>Qty:</strong> {item.qty}</span>
                    )}
                    <span><strong>Date:</strong> {new Date(item.date_input).toLocaleDateString()}</span>
                    {item.follow_up_status === 'closed' && item.user_follow_up && (
                      <span><strong>Closed by:</strong> {item.user_follow_up}</span>
                    )}
                  </div>

                  {item.remarks && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded text-xs">{item.remarks}</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusList;