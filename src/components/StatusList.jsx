import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, CheckCircle } from 'lucide-react';

const StatusList = ({ title, items, onFollowUpStatus, getStatusIcon, getFollowUpIcon, emptyMessage, selectedItems = [], onSelectionChange }) => {
  const [expanded, setExpanded] = useState(new Set());
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-blue-100/80 bg-white/80 p-8 text-center shadow-[0_10px_28px_rgba(37,99,235,0.06)]">
        <div className="mb-4 text-blue-300">
          {title === 'Open Status' && <Clock className="h-12 w-12 mx-auto" />}
          {title === 'On Progress Status' && <Clock className="h-12 w-12 mx-auto" />}
          {title === 'Closed Status' && <CheckCircle className="h-12 w-12 mx-auto" />}
        </div>
        <h3 className="mb-2 text-lg font-bold tracking-tight text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-blue-100/80 bg-white shadow-[0_10px_28px_rgba(37,99,235,0.07)]">
      <div className="border-b border-blue-100/80 bg-gradient-to-r from-blue-50/80 to-white px-6 py-5">
        <h3 className="text-lg font-bold tracking-tight text-slate-900">{title}</h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="divide-y divide-blue-50">
        {items.map((item) => (
          <div key={item.id} className="p-4 transition-colors hover:bg-blue-50/60">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelectionChange(item.id, e.target.checked);
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 min-w-0">
                    {getStatusIcon(item.inventory_status)}
                  <h4 className="break-words text-base font-semibold leading-tight text-slate-900">{item.item_name}</h4>
                    {getFollowUpIcon(item.follow_up_status)}
                  </div>
                  {/* Details hidden by default; shown in accordion below */}
                  {expanded.has(item.id) && (
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                        <span><strong>SKU:</strong> {item.sku}</span>
                        {item.internal_product_code && (
                          <span><strong>Code:</strong> {item.internal_product_code}</span>
                        )}
                        {item.qty && (
                          <span><strong>Qty:</strong> {item.qty}</span>
                        )}
                        <span>
                          <strong>Date:</strong> {new Date(item.date_input).toLocaleDateString('id-ID')}
                        </span>
                        {item.user_report_name && (
                          <span><strong>By:</strong> {item.user_report_name}</span>
                        )}
                        {item.user_follow_up_name && (
                          <span><strong>Updated by:</strong> {item.user_follow_up_name}</span>
                        )}
                      </div>

                      {item.remarks && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded text-xs">{item.remarks}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(prev => {
                    const next = new Set(prev);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  });
                }}
                className="ml-3 rounded-lg p-1 text-slate-400 transition hover:bg-blue-100 hover:text-blue-700"
                aria-label={expanded.has(item.id) ? 'Collapse details' : 'Expand details'}
              >
                {expanded.has(item.id) ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusList;
