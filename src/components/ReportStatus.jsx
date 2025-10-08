import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Filter, AlertTriangle, TrendingUp, Clock, CheckCircle, Edit } from 'lucide-react';
import StatusModal from './StatusModal';
import StatusList from './StatusList';
import BulkFollowUpModal from './BulkFollowUpModal';
import { supabase } from '../lib/supabase';

const ReportStatus = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusType, setStatusType] = useState('kritis'); // 'kritis' or 'over'
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);

  // Fetch reports on component mount and when filter changes
  useEffect(() => {
    fetchReports();
  }, [filterDate]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('report_status_raw_mat')
        .select('*')
        .eq('date_input', filterDate)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Map user_report UUIDs to profile full names
      const userIds = [...new Set((data || []).map(r => r.user_report).filter(Boolean))];
      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        if (!profilesError && profilesData) {
          profilesData.forEach(p => { profileMap[p.id] = p.name; });
        }
      }

      const enriched = (data || []).map(r => ({
        ...r,
        user_report_name: profileMap[r.user_report] || null
      }));

      setReports(enriched);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStatus = (type) => {
    setStatusType(type);
    setIsStatusModalOpen(true);
  };

  const handleStatusSubmit = async (formData) => {
    console.log('handleStatusSubmit called with:', formData);
    try {
      const { data, error } = await supabase
        .from('report_status_raw_mat')
        .insert([{
          ...formData,
          user_report: user.id,
          inventory_status: statusType
        }])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Insert successful:', data);
      // Refresh reports
      fetchReports();
      setIsStatusModalOpen(false);
    } catch (error) {
      console.error('Error adding status report:', error);
      throw error; // Re-throw error so modal can handle it
    }
  };


  const handleSelectionChange = (itemId, isSelected) => {
    if (isSelected) {
      setSelectedItems(prev => [...prev, itemId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    try {
      const { data, error } = await supabase
        .from('report_status_raw_mat')
        .update({
          follow_up_status: newStatus,
          user_follow_up: user.id
        })
        .in('id', selectedItems)
        .select();

      if (error) throw error;

      // Refresh reports and clear selection
      fetchReports();
      setSelectedItems([]);
      setIsBulkStatusModalOpen(false);
    } catch (error) {
      console.error('Error updating bulk follow up status:', error);
      throw error;
    }
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  // Filter reports based on active tab
  const filteredReports = reports.filter(report => {
    if (activeTab === 'all') return true;
    return report.follow_up_status === activeTab;
  });

  // Group reports by follow up status for display
  const groupedReports = {
    open: reports.filter(r => r.follow_up_status === 'open'),
    on_progress: reports.filter(r => r.follow_up_status === 'on_progress'),
    closed: reports.filter(r => r.follow_up_status === 'closed')
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'kritis':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'over':
        return <TrendingUp className="h-4 w-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getFollowUpIcon = (status) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'on_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'closed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Report Status Raw Material</h1>
                <p className="text-gray-600">Monitor and manage raw material inventory status</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto pt-3 pb-8 sm:px-6 lg:px-8">
        <div className="px-4 py-3 sm:px-0">
          {/* Action Buttons + Date Filter */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleAddStatus('kritis')}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Status Kritis
            </button>
            <button
              onClick={() => handleAddStatus('over')}
              className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Status Over
            </button>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Bulk Selection Actions */}
          {selectedItems.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Clear selection
                  </button>
                </div>
                <button
                  onClick={() => setIsBulkStatusModalOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Change Status
                </button>
              </div>
            </div>
          )}

          {/* Date filter moved next to action buttons */}

          {/* Status Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {[
                  { key: 'all', label: 'All Status', count: reports.length },
                  { key: 'open', label: 'Open', count: groupedReports.open.length },
                  { key: 'on_progress', label: 'On Progress', count: groupedReports.on_progress.length },
                  { key: 'closed', label: 'Closed', count: groupedReports.closed.length }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-blue-500 bg-white transition ease-in-out duration-150">
                Loading...
              </div>
            </div>
          ) : (
            /* Status Lists */
            <div className="space-y-6">
              {activeTab === 'all' || activeTab === 'open' ? (
                <StatusList
                  title="Open Status"
                  items={groupedReports.open}
                  getStatusIcon={getStatusIcon}
                  getFollowUpIcon={getFollowUpIcon}
                  emptyMessage="No open status reports"
                  selectedItems={selectedItems}
                  onSelectionChange={handleSelectionChange}
                />
              ) : null}

              {activeTab === 'all' || activeTab === 'on_progress' ? (
                <StatusList
                  title="On Progress Status"
                  items={groupedReports.on_progress}
                  getStatusIcon={getStatusIcon}
                  getFollowUpIcon={getFollowUpIcon}
                  emptyMessage="No on progress status reports"
                  selectedItems={selectedItems}
                  onSelectionChange={handleSelectionChange}
                />
              ) : null}

              {activeTab === 'all' || activeTab === 'closed' ? (
                <StatusList
                  title="Closed Status"
                  items={groupedReports.closed}
                  getStatusIcon={getStatusIcon}
                  getFollowUpIcon={getFollowUpIcon}
                  emptyMessage="No closed status reports"
                  selectedItems={selectedItems}
                  onSelectionChange={handleSelectionChange}
                />
              ) : null}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <StatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onSubmit={handleStatusSubmit}
        statusType={statusType}
      />

      <BulkFollowUpModal
        isOpen={isBulkStatusModalOpen}
        onClose={() => {
          setIsBulkStatusModalOpen(false);
        }}
        onSubmit={handleBulkStatusUpdate}
        selectedItems={selectedItems}
        reports={reports}
      />
    </div>
  );
};

export default ReportStatus;