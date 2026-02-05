import { useState, useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { LoginView } from './views/LoginView';
import { EmailVerificationView } from './views/EmailVerificationView';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { Toast } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BottomNavigation } from './components/BottomNavigation';
import { AppRoutes } from './components/AppRoutes';
import { useBudgetStore } from './stores/budgetStore';
import { useAuthStore } from './stores/authStore';
import { AddTransactionView } from './views/AddTransactionView';

function App() {
  // State: Mimicking @State private var showingLaunchScreen
  const [showingLaunchScreen, setShowingLaunchScreen] = useState(true);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const { appSettings, isOnboardingActive } = useBudgetStore();
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

  // Font Size effect: Adjust root font size based on settings
  useEffect(() => {
    const root = document.documentElement;
    const size = appSettings?.fontSize ?? 'medium';
    
    switch (size) {
      case 'extra-small':
        root.style.fontSize = '75%'; // 12px
        break;
      case 'small':
        root.style.fontSize = '87.5%'; // 14px
        break;
      case 'large':
        root.style.fontSize = '112.5%'; // 18px
        break;
      case 'extra-large':
        root.style.fontSize = '125%'; // 20px
        break;
      default:
        root.style.fontSize = '100%'; // 16px
    }
  }, [appSettings?.fontSize]);

  // Splash Screen View - Show loading screen during initialization
  if (showingLaunchScreen || !isInitialized) {
    return <LoadingScreen message="Initializing Personal Budget..." />;
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
    <>
      {/* iOS Haptic Trigger - Invisible & Non-interactive */}
      <div className="fixed opacity-0 pointer-events-none -z-50">
        <label id="ios-haptic-trigger" htmlFor="ios-haptic-checkbox">
          {/* @ts-ignore - 'switch' is a non-standard iOS attribute for system haptics */}
          <input type="checkbox" id="ios-haptic-checkbox" switch="true" />
        </label>
      </div>

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
        <AppRoutes />

        {showAddTransactionModal && (
          <div className="fixed inset-0 z-[60]">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowAddTransactionModal(false)}
            />
            <div className="absolute inset-0">
              <AddTransactionView
                onClose={() => setShowAddTransactionModal(false)}
                onSaved={() => setShowAddTransactionModal(false)}
              />
            </div>
          </div>
        )}

        {/* Bottom Navigation - Only show on main app pages and when not onboarding */}
        {!isOnboardingActive && (
          <BottomNavigation onAddTransaction={() => setShowAddTransactionModal(true)} />
        )}
      </HashRouter>

      {/* Global Toast Notifications */}
      <Toast />
    </ErrorBoundary>
    </>
  );
}

export default App;