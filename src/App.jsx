import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import LoadingSpinner from './components/LoadingSpinner';
import AdminDashboard from './components/AdminDashboard';
import SessionSelection from './components/SessionSelection';
import GroupSessionSelection from './components/GroupSessionSelection';
import ItemsList from './components/ItemsList';

const App = () => {
  const { user, profile, loading, isAuthenticated, isAdmin, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState('login');
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedGroupSession, setSelectedGroupSession] = useState(null);

  // Show loading spinner while checking authentication
  if (loading) {
    return <LoadingSpinner />;
  }

  // If not authenticated, show login form
  if (!isAuthenticated || !user) {
    return <LoginForm />;
  }

  // Handle page navigation based on user role and current page
  const handleSessionSelect = (session) => {
    setSelectedSession(session);
    setCurrentPage('items-list');
  };

  const handleBackToSessions = () => {
    setSelectedSession(null);
    setSelectedGroupSession(null);
    setCurrentPage('select-session');
  };

  const handleGroupSessionSelect = (groupSession) => {
    setSelectedGroupSession(groupSession);
    setCurrentPage('items-list');
  };

  const handleBackToGroupSessions = () => {
    setSelectedGroupSession(null);
    setCurrentPage('group-session-selection');
  };

  // Admin dashboard
  if (isAdmin && currentPage === 'login') {
    return <AdminDashboard user={user} signOut={signOut} />;
  }

  // Counter session selection
  if (!isAdmin && currentPage === 'select-session') {
    return <SessionSelection onSessionSelect={handleSessionSelect} />;
  }

  // Counter group session selection
  if (!isAdmin && currentPage === 'group-session-selection') {
    return (
      <GroupSessionSelection
        session={selectedSession}
        onGroupSessionSelect={handleGroupSessionSelect}
        onBack={handleBackToSessions}
      />
    );
  }

  // Items counting page
  if (currentPage === 'items-list' && selectedSession) {
    return (
      <ItemsList
        session={selectedSession}
        groupSession={selectedGroupSession}
        onBack={selectedGroupSession ? handleBackToGroupSessions : handleBackToSessions}
      />
    );
  }

  // Default routing based on user role
  if (isAdmin) {
    return <AdminDashboard user={user} signOut={signOut} />;
  } else {
    return <SessionSelection onSessionSelect={handleSessionSelect} />;
  }
};

export default App;