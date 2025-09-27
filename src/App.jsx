import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import LoadingSpinner from './components/LoadingSpinner';
import AdminDashboard from './components/AdminDashboard';
import SessionSelection from './components/SessionSelection';
import ItemsList from './components/ItemsList';

const App = () => {
  const { user, profile, loading, isAuthenticated, isAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState('login');
  const [selectedSession, setSelectedSession] = useState(null);

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
    setCurrentPage('select-session');
  };

  // Admin dashboard
  if (isAdmin && currentPage === 'login') {
    return <AdminDashboard />;
  }

  // Counter session selection
  if (!isAdmin && currentPage === 'select-session') {
    return <SessionSelection onSessionSelect={handleSessionSelect} />;
  }

  // Items counting page
  if (currentPage === 'items-list' && selectedSession) {
    return (
      <ItemsList
        session={selectedSession}
        onBack={handleBackToSessions}
      />
    );
  }

  // Default routing based on user role
  if (isAdmin) {
    return <AdminDashboard />;
  } else {
    return <SessionSelection onSessionSelect={handleSessionSelect} />;
  }
};

export default App;