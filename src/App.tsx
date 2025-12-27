import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { EnvelopeListView } from './views/EnvelopeListView';
// 1. ADD THIS IMPORT
import EnvelopeDetail from './views/EnvelopeDetail';
import { SettingsView } from './views/SettingsView';
import { AddEnvelopeView } from './views/AddEnvelopeView';
import { AddTransactionView } from './views/AddTransactionView';
import { TransactionHistoryView } from './views/TransactionHistoryView';
import { LoginView } from './views/LoginView';
import { EmailVerificationView } from './views/EmailVerificationView';
import { Toast } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useEnvelopeStore } from './stores/envelopeStore';
import { useAuthStore } from './stores/authStore';

function App() {
  // State: Mimicking @State private var showingLaunchScreen
  const [showingLaunchScreen, setShowingLaunchScreen] = useState(true);
  const { appSettings } = useEnvelopeStore();
  const { isAuthenticated, isInitialized, initializeAuth, lastAuthTime, offlineGracePeriod, currentUser } = useAuthStore();

  // Effect: Mimicking .onAppear { DispatchQueue... }
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowingLaunchScreen(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize Firebase Auth
  useEffect(() => {
    const unsubscribe = initializeAuth();
    return unsubscribe;
  }, [initializeAuth]);

  // Theme effect: toggle html.dark based on app settings theme preference
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const currentTheme = appSettings?.theme ?? 'system';
      const systemPrefersDark = mediaQuery.matches;
      const isDark = currentTheme === 'dark' || (currentTheme === 'system' && systemPrefersDark);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    if (appSettings?.theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }

    return undefined;
  }, [appSettings]);

  // Splash Screen View
  if (showingLaunchScreen || !isInitialized) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-blue-600 text-white dark:bg-black">
        <div className="text-3xl font-bold animate-pulse">
          Personal Budget
        </div>
      </div>
    );
  }

  // Login View - Show when not authenticated
  // Show verification screen if user is registered but not verified
  if (!isAuthenticated) {
    if (currentUser) {
      return (
        <ErrorBoundary>
          <EmailVerificationView />
        </ErrorBoundary>
      );
    }
    return (
      <ErrorBoundary>
        <LoginView />
      </ErrorBoundary>
    );
  }

  // Check if using offline grace period
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const isUsingGracePeriod = isOffline && isAuthenticated && lastAuthTime &&
    (Date.now() - lastAuthTime) < offlineGracePeriod;

  // Main App View
  return (
    <ErrorBoundary>
      {/* Offline Grace Period Banner */}
      {isUsingGracePeriod && (
        <div className="bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-200 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">
                <strong>Offline Access:</strong> You're using cached authentication. Expires in{' '}
                {Math.ceil((offlineGracePeriod - (Date.now() - lastAuthTime!)) / (24 * 60 * 60 * 1000))}{' '}
                days. Connect to internet to refresh.
              </p>
            </div>
          </div>
        </div>
      )}

      <HashRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              <ErrorBoundary>
                <EnvelopeListView />
              </ErrorBoundary>
            } 
          />
          <Route 
            path="/envelope/:id" 
            element={
              <ErrorBoundary>
                <EnvelopeDetail />
              </ErrorBoundary>
            } 
          />
          <Route 
            path="/add-envelope" 
            element={
              <ErrorBoundary>
                <AddEnvelopeView />
              </ErrorBoundary>
            } 
          />
          <Route 
            path="/add-transaction" 
            element={
              <ErrorBoundary>
                <AddTransactionView />
              </ErrorBoundary>
            } 
          />
          <Route 
            path="/transactions" 
            element={
              <ErrorBoundary>
                <TransactionHistoryView />
              </ErrorBoundary>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ErrorBoundary>
                <SettingsView />
              </ErrorBoundary>
            } 
          />
          <Route 
            path="/verify-email" 
            element={
              <ErrorBoundary>
                <EmailVerificationView />
              </ErrorBoundary>
            } 
          />
        </Routes>
      </HashRouter>

      {/* Global Toast Notifications */}
      <Toast />
    </ErrorBoundary>
  );
}

export default App;