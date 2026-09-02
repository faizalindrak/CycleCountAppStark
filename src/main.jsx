import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import AppUpdateToast from './components/AppUpdateToast.jsx';
import PwaInstallPrompt from './components/PwaInstallPrompt.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
      <AppUpdateToast />
      <PwaInstallPrompt />
    </ThemeProvider>
  </React.StrictMode>,
);
