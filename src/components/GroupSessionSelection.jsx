import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ChevronLeft,
  LogOut,
  Package,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const GroupSessionSelection = ({ session, onGroupSessionSelect, onBack }) => {
  const { user, signOut } = useAuth();
  const [groupSessions, setGroupSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && session) {
      fetchUserGroupSessions();
    }
  }, [user, session]);

  const fetchUserGroupSessions = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch group sessions the user is assigned to for this session
      const { data, error } = await supabase
        .from('group_session_users')
        .select(`
          group_sessions (
            id,
            name,
            description,
            created_date,
            is_active,
            group_session_items (count),
            group_session_users (count)
          )
        `)
        .eq('group_sessions.session_id', session.id)
        .eq('user_id', user.id);

      if (error) throw error;

      const userGroupSessions = data?.map(item => item.group_sessions).filter(Boolean) || [];
      setGroupSessions(userGroupSessions);
    } catch (err) {
      console.error('Error fetching group sessions:', err);
      setError('Failed to load group sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-white shadow-sm">
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
                    Loading group sessions...
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-600 hidden sm:block">
                  Welcome, {user?.user_metadata?.name || user?.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-red-600 hover:text-red-800"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
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
      <div className="bg-white shadow-sm">
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
                  Select a group session to start counting
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600 hidden sm:block">
                Welcome, {user?.user_metadata?.name || user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-red-600 hover:text-red-800"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Available Group Sessions
          </h2>
          <p className="text-gray-600 text-sm">
            Select a group session to view and count the items assigned to you.
          </p>
        </div>

        {groupSessions.length === 0 ? (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-2">
              {error || 'No group sessions are currently assigned to you.'}
            </p>
            <p className="text-sm text-gray-400">
              Please contact your administrator to be assigned to a group session.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {groupSessions.map((groupSession) => (
              <div
                key={groupSession.id}
                onClick={() => onGroupSessionSelect(groupSession)}
                className="bg-white p-6 rounded-lg shadow hover:shadow-md cursor-pointer transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {groupSession.name}
                      </h3>
                      {groupSession.is_active ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>

                    {groupSession.description && (
                      <p className="text-gray-600 mb-3">
                        {groupSession.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Package className="h-4 w-4 mr-1" />
                        {groupSession.group_session_items?.[0]?.count || 0} items to count
                      </span>
                      <span className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {groupSession.group_session_users?.[0]?.count || 0} counters assigned
                      </span>
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Created: {new Date(groupSession.created_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      groupSession.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {groupSession.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-sm text-gray-400">
                      Click to select →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {groupSessions.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Don't see your group session? Contact your administrator to be assigned to a group session.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default GroupSessionSelection;