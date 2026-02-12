import { useState, useEffect } from 'react';
import { applyActionCode } from 'firebase/auth';
import { HashRouter } from 'react-router-dom';
import { LoginView } from './views/LoginView';
import { ResetPasswordView } from './views/ResetPasswordView';
import { EmailVerificationView } from './views/EmailVerificationView';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { Toast } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BottomNavigation } from './components/BottomNavigation';
import { AppRoutes } from './components/AppRoutes';
import { SiriQueryHandler } from './components/SiriQueryHandler';
import { GuidedTutorialOverlay } from './components/ui/guidedTutorialOverlay';
import { useBudgetStore } from './stores/budgetStore';
import { useAuthStore } from './stores/authStore';
import { useToastStore } from './stores/toastStore';
import { AddTransactionView } from './views/AddTransactionView';
import { auth } from './firebase';
import logger from './utils/logger';

function App() {
  // State: Mimicking @State private var showingLaunchScreen
  const [showingLaunchScreen, setShowingLaunchScreen] = useState(true);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [resetPasswordCode, setResetPasswordCode] = useState<string | null>(null);
  const { appSettings, isOnboardingActive } = useBudgetStore();
  const { isAuthenticated, isInitialized, initializeAuth, lastAuthTime, offlineGracePeriod, currentUser } = useAuthStore();
  const { showToast } = useToastStore();

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

  // Handle email verification and password reset from URL parameters
  useEffect(() => {
    const handleUrlActions = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');
      const oobCode = urlParams.get('oobCode');

      if (mode === 'resetPassword' && oobCode) {
        logger.log('🔗 Processing password reset from URL');
        setResetPasswordCode(oobCode);
        return;
      }

      if (mode === 'verifyEmail' && oobCode) {
        logger.log('🔗 Processing email verification from URL');
        try {
          await applyActionCode(auth, oobCode);
          logger.log('✅ Email verification successful');

          // Clean up URL parameters
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);

          // Force reload user to update verified status
          if (auth.currentUser) {
            await auth.currentUser.reload();
            logger.log('🔄 User reloaded after verification');
            
            // Trigger onboarding check manually after verification success
            const budgetStore = await import('./stores/budgetStore').then(m => m.useBudgetStore.getState());
            logger.log('🔍 Triggering onboarding check after email verification...');
            await budgetStore.checkAndStartOnboarding();
          }

          showToast('Email verified successfully! You can now sign in.', 'success');
          
          // Wait 2 seconds before signing out so user can see the toast
          setTimeout(async () => {
            // Sign out the user so they can sign back in with verified status
            await auth.signOut();
          }, 2000);

        } catch (error: any) {
          logger.error('❌ Email verification failed:', error);
          showToast('Email verification failed. The link may be expired or invalid.', 'error');
        }
      }
    };

    handleUrlActions();
  }, []);

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
    return (
      <>
        <LoadingScreen message="Initializing Personal Budget..." />
        <Toast />
      </>
    );
  }

  // Reset Password View - Show when processing a password reset code
  if (resetPasswordCode) {
    return (
      <ErrorBoundary>
        <ResetPasswordView 
          oobCode={resetPasswordCode}
          onSuccess={() => {
            setResetPasswordCode(null);
            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          }}
          onCancel={() => {
            setResetPasswordCode(null);
            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          }}
        />
        <Toast />
      </ErrorBoundary>
    );
  }

  // Login View - Show when not authenticated
  // Show verification screen if user is registered but not verified
  if (!isAuthenticated) {
    if (currentUser) {
      return (
        <ErrorBoundary>
          <EmailVerificationView />
          <Toast />
        </ErrorBoundary>
      );
    }
    return (
      <ErrorBoundary>
        <LoginView />
        <Toast />
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
          {/* @ts-expect-error - 'switch' is a non-standard iOS attribute for system haptics */}
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
          <SiriQueryHandler />
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

          {/* Guided Tutorial Overlay */}
          <GuidedTutorialOverlay />

          {/* Bottom Navigation - Only show on main app pages and when not onboarding */}
          {!isOnboardingActive && (
            <BottomNavigation onAddTransaction={() => setShowAddTransactionModal(true)} />
          )}
        </HashRouter>
      </ErrorBoundary>
    </>
  );
}

export default App;