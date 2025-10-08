import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import LoadingSpinner from './components/LoadingSpinner';
import Home from './components/Home';
import AdminDashboard from './components/AdminDashboard';
import SessionSelection from './components/SessionSelection';
import ItemsList from './components/ItemsList';
import ReportStatus from './components/ReportStatus';

// Protected Route component for authenticated users
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, profile, loading, isAuthenticated, isAdmin } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/sessions" replace />;
  }

  return children;
};

// Public Route component (redirects to appropriate page if already authenticated)
const PublicRoute = ({ children }) => {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated && user) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

const App = () => {
  const { user, signOut } = useAuth();

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public route - Login page */}
          <Route
            path="/"
            element={
              <PublicRoute>
                <LoginForm />
              </PublicRoute>
            }
          />

          {/* Protected routes for authenticated users */}
          {/* Home page */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminDashboard user={user} signOut={signOut} />
              </ProtectedRoute>
            }
          />

          {/* Session selection for non-admin users */}
          <Route
            path="/sessions"
            element={
              <ProtectedRoute>
                <SessionSelection />
              </ProtectedRoute>
            }
          />

          {/* Items counting page */}
          <Route
            path="/counting/:sessionId"
            element={
              <ProtectedRoute>
                <ItemsList />
              </ProtectedRoute>
            }
          />

          {/* Report Status Raw Material page */}
          <Route
            path="/reportstatus"
            element={
              <ProtectedRoute>
                <ReportStatus />
              </ProtectedRoute>
            }
          />

          {/* Catch all route - redirect to appropriate page based on auth status */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;