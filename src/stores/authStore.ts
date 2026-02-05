import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  updateProfile, 
  sendPasswordResetEmail, 
  sendEmailVerification as firebaseSendEmailVerification, 
  deleteUser, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  confirmPasswordReset
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';
import type { User } from '../models/types';

// Helper for verification redirects
const getActionCodeSettings = () => ({
  url: window.location.origin + import.meta.env.BASE_URL,
  handleCodeInApp: false,
});

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  loginError: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  isInitializing?: boolean; // For internal use during initialization
  lastAuthTime: number | null; // Track last successful auth time for offline grace period
  offlineGracePeriod: number; // Grace period in milliseconds (7 days)
  lastVerificationEmailSent: number | null; // Track last verification email sent time for rate limiting
}

interface AuthActions {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  sendEmailVerification: () => Promise<boolean>;
  resendEmailVerification: () => Promise<boolean>;
  checkVerificationStatus: () => Promise<boolean>;
  confirmPasswordReset: (oobCode: string, newPassword: string) => Promise<boolean>;
  deleteAccount: (password: string) => Promise<boolean>;
  clearError: () => void;
  initializeAuth: () => () => void; // Returns cleanup function
}

type AuthStore = AuthState & AuthActions;

// Convert Firebase User to our User type
const firebaseUserToUser = (firebaseUser: FirebaseUser): User => ({
  id: firebaseUser.uid,
  username: firebaseUser.email || firebaseUser.uid,
  displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
  email: firebaseUser.email || undefined,
});

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,
      loginError: null,
      isLoading: false,
      isInitialized: false,
      isInitializing: true,
      lastAuthTime: null, // Track last successful auth time
      offlineGracePeriod: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      lastVerificationEmailSent: null, // Track last verification email sent time

      login: async (email: string, password: string): Promise<boolean> => {
        set({ isLoading: true, loginError: null });

        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;

          // Check if email is verified
          console.log(`🔍 Checking email verification for: ${firebaseUser.email}`);
          console.log(`🔍 emailVerified status:`, firebaseUser.emailVerified);
          console.log(`🔍 Firebase user object:`, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            emailVerified: firebaseUser.emailVerified,
            metadata: firebaseUser.metadata
          });

          if (!firebaseUser.emailVerified) {
            console.log(`❌ BLOCKING LOGIN: Email not verified for ${firebaseUser.email}`);
            // Sign out the user since they can't access the app without verification
            await firebaseSignOut(auth);
            set({
              currentUser: null,
              isAuthenticated: false,
              isLoading: false,
              loginError: 'Please verify your email address before signing in. Check your email for a verification link.'
            });
            console.log(`❌ Login blocked: ${firebaseUser.email} not verified`);
            return false;
          }

          console.log(`✅ EMAIL VERIFIED: Allowing login for ${firebaseUser.email}`);

          const user = firebaseUserToUser(firebaseUser);

          set({
            currentUser: user,
            isAuthenticated: true,
            isLoading: false,
            loginError: null,
            lastAuthTime: Date.now() // Record successful auth time
          });
          console.log(`✅ User logged in: ${user.email}`);
          return true;
        } catch (error: any) {
          console.error('Login error:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);

          let errorMessage = 'Login failed. Please try again.';

          // Handle Firebase Auth errors
          if (error.code) {
            switch (error.code) {
              case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
              case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
              case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
              case 'auth/wrong-password':
                errorMessage = 'Incorrect password.';
                break;
              case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
              case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your connection and try again.';
                break;
              case 'auth/invalid-credential':
                errorMessage = 'Invalid email or password.';
                break;
              default:
                // For debugging - show the actual error code
                console.warn(`Unhandled Firebase error code: ${error.code}`);
                errorMessage = 'Authentication failed. Please try again.';
                break;
            }
          } else {
            // Handle non-Firebase errors
            console.warn('Non-Firebase error in login:', error);
            errorMessage = 'An unexpected error occurred. Please try again.';
          }

          set({
            currentUser: null,
            isAuthenticated: false,
            isLoading: false,
            loginError: errorMessage
          });
          return false;
        }
      },

      register: async (email: string, password: string, displayName: string): Promise<boolean> => {
        set({ isLoading: true, loginError: null });

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;

          // Set display name
          await updateProfile(firebaseUser, { displayName });

          // Send verification email with redirect back to app
          await firebaseSendEmailVerification(firebaseUser, getActionCodeSettings());

          const user = firebaseUserToUser(firebaseUser);

          set({
            currentUser: user,
            isAuthenticated: false, // Don't authenticate until email is verified
            isLoading: false,
            loginError: null,
            lastVerificationEmailSent: Date.now() // Record verification email sent time
          });
          console.log(`✅ User registered: ${user.email}, verification email sent`);
          return true;
        } catch (error: any) {
          console.error('Registration error:', error);
          let errorMessage = 'Registration failed. Please try again.';

          switch (error.code) {
            case 'auth/email-already-in-use':
              errorMessage = 'An account with this email already exists.';
              break;
            case 'auth/invalid-email':
              errorMessage = 'Invalid email address.';
              break;
            case 'auth/weak-password':
              errorMessage = 'Password should be at least 6 characters.';
              break;
            case 'auth/operation-not-allowed':
              errorMessage = 'Email/password accounts are not enabled.';
              break;
          }

          set({
            currentUser: null,
            isAuthenticated: false,
            isLoading: false,
            loginError: errorMessage
          });
          return false;
        }
      },

      logout: async () => {
        try {
          await firebaseSignOut(auth);
          console.log('👋 User logged out');
        } catch (error) {
          console.error('Logout error:', error);
        }
        // Firebase auth state listener will handle the state update
      },

      clearError: () => {
        set({ loginError: null });
      },

      sendPasswordReset: async (email: string): Promise<boolean> => {
        set({ isLoading: true, loginError: null });

        try {
          await sendPasswordResetEmail(auth, email);
          set({ isLoading: false });
          return true;
        } catch (error: any) {
          console.error('Password reset error:', error);
          let errorMessage = 'Failed to send password reset email. Please try again.';

          switch (error.code) {
            case 'auth/user-not-found':
              errorMessage = 'No account found with this email.';
              break;
            case 'auth/invalid-email':
              errorMessage = 'Invalid email address.';
              break;
            case 'auth/too-many-requests':
              errorMessage = 'Too many attempts. Please try again later.';
              break;
          }

          set({
            isLoading: false,
            loginError: errorMessage
          });
          return false;
        }
      },

      sendEmailVerification: async (): Promise<boolean> => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          set({ loginError: 'No user is currently signed in.' });
          return false;
        }

        set({ isLoading: true, loginError: null });

        try {
          await firebaseSendEmailVerification(currentUser, getActionCodeSettings());
          set({
            isLoading: false,
            lastVerificationEmailSent: Date.now()
          });
          console.log(`✅ Verification email sent to: ${currentUser.email}`);
          return true;
        } catch (error: any) {
          console.error('Email verification error:', error);
          let errorMessage = 'Failed to send verification email. Please try again.';

          switch (error.code) {
            case 'auth/too-many-requests':
              errorMessage = 'Too many verification emails sent. Please wait before trying again.';
              break;
          }

          set({
            isLoading: false,
            loginError: errorMessage
          });
          return false;
        }
      },

      resendEmailVerification: async (): Promise<boolean> => {
        const state = useAuthStore.getState();

        // Rate limiting: prevent sending more than once per minute
        if (state.lastVerificationEmailSent) {
          const timeSinceLastEmail = Date.now() - state.lastVerificationEmailSent;
          const rateLimitMs = 60 * 1000; // 60 seconds

          if (timeSinceLastEmail < rateLimitMs) {
            const remainingSeconds = Math.ceil((rateLimitMs - timeSinceLastEmail) / 1000);
            set({
              loginError: `Please wait ${remainingSeconds} seconds before requesting another verification email.`
            });
            return false;
          }
        }

        return state.sendEmailVerification();
      },

      checkVerificationStatus: async (): Promise<boolean> => {
        const currentUser = auth.currentUser;
        if (!currentUser) return false;

        try {
          // Reload the user to get the latest emailVerified status
          await currentUser.reload();
          const updatedUser = auth.currentUser;
          
          if (updatedUser?.emailVerified) {
            const user = firebaseUserToUser(updatedUser);
            set({
              currentUser: user,
              isAuthenticated: true,
              lastAuthTime: Date.now()
            });
            console.log(`✅ Email verified for: ${updatedUser.email}`);
            return true;
          }
          return false;
        } catch (error) {
          console.error('Error checking verification status:', error);
          return false;
        }
      },

      deleteAccount: async (password: string): Promise<boolean> => {
        const currentUser = auth.currentUser;
        if (!currentUser || !currentUser.email) {
          set({ loginError: 'No user is currently signed in.' });
          return false;
        }

        set({ isLoading: true, loginError: null });

        try {
          // Re-authenticate user (required for account deletion)
          const credential = EmailAuthProvider.credential(currentUser.email, password);
          await reauthenticateWithCredential(currentUser, credential);

          // Delete all user data from Firebase first
          // Note: This will be handled by the envelopeStore.resetData() call in the UI layer

          // Delete the Firebase user account
          await deleteUser(currentUser);

          // Clear local state and sign out
          set({
            currentUser: null,
            isAuthenticated: false,
            isLoading: false,
            loginError: null,
            lastAuthTime: null
          });

          console.log(`✅ Account permanently deleted: ${currentUser.email}`);
          return true;
        } catch (error: any) {
          console.error('Account deletion error:', error);
          let errorMessage = 'Failed to delete account. Please try again.';

          switch (error.code) {
            case 'auth/requires-recent-login':
              errorMessage = 'For security, please log out and log back in before deleting your account.';
              break;
            case 'auth/wrong-password':
              errorMessage = 'Incorrect password. Please enter your current password.';
              break;
            case 'auth/too-many-requests':
              errorMessage = 'Too many deletion attempts. Please wait before trying again.';
              break;
            case 'auth/network-request-failed':
              errorMessage = 'Network error. Please check your connection and try again.';
              break;
          }

          set({
            isLoading: false,
            loginError: errorMessage
          });
          return false;
        }
      },

      confirmPasswordReset: async (oobCode: string, newPassword: string): Promise<boolean> => {
        set({ isLoading: true, loginError: null });

        try {
          await confirmPasswordReset(auth, oobCode, newPassword);
          set({ isLoading: false });
          console.log('✅ Password reset successful');
          return true;
        } catch (error: any) {
          console.error('Password reset confirmation error:', error);
          let errorMessage = 'Failed to reset password. The link may be expired or invalid.';

          switch (error.code) {
            case 'auth/expired-action-code':
              errorMessage = 'The password reset link has expired. Please request a new one.';
              break;
            case 'auth/invalid-action-code':
              errorMessage = 'The password reset link is invalid. Please request a new one.';
              break;
            case 'auth/weak-password':
              errorMessage = 'Password should be at least 6 characters.';
              break;
          }

          set({
            isLoading: false,
            loginError: errorMessage
          });
          return false;
        }
      },

      initializeAuth: () => {
        // Check if already initialized to prevent resetting during Firebase reconnects
        const currentState = useAuthStore.getState();
        if (currentState.isInitialized) {
          // Already initialized, return empty unsubscribe function
          return () => {};
        }

        set({ isInitialized: false });

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          const now = Date.now();
          const currentState = useAuthStore.getState(); // Use getState() instead of get()

          const user = firebaseUser ? firebaseUserToUser(firebaseUser) : null;

          // Check if we're within the offline grace period
          const isWithinGracePeriod = currentState.lastAuthTime &&
            (now - currentState.lastAuthTime) < currentState.offlineGracePeriod;

          // Allow offline access if within grace period and offline
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

          const shouldGrantOfflineAccess = isOffline && currentState.isAuthenticated &&
            isWithinGracePeriod && !user; // No current Firebase user but we have persisted state

          // Only grant access if user is verified (unless offline grace period applies)
          const isVerified = firebaseUser ? firebaseUser.emailVerified : true; // Assume verified for offline grace period

          // Effective authentication state - user must be verified to be authenticated
          const effectiveAuthenticated = (firebaseUser && isVerified) || !!shouldGrantOfflineAccess;
          const effectiveUser = firebaseUser ? user : (shouldGrantOfflineAccess ? currentState.currentUser : null);

          set({
            currentUser: effectiveUser,
            isAuthenticated: effectiveAuthenticated,
            isInitialized: true,
            isLoading: false,
            loginError: null,
            lastAuthTime: (firebaseUser && isVerified) ? now : currentState.lastAuthTime // Update only on successful verified auth
          });

          if (effectiveUser) {
            console.log(`🔄 Auth state: User is signed in (${effectiveUser.email})`,
              shouldGrantOfflineAccess ? '(offline grace period)' : isVerified ? '(verified)' : '(unverified)');

            // Check if we should start onboarding for new users
            console.log('🔍 Onboarding check:', {
              isVerified,
              shouldGrantOfflineAccess,
              willCheckOnboarding: isVerified && !shouldGrantOfflineAccess
            });
            
            if (isVerified && !shouldGrantOfflineAccess) {
              console.log('🔍 Loading budgetStore to check onboarding...');
              const budgetStore = await import('./budgetStore').then(m => m.useBudgetStore.getState());
              console.log('🔍 Calling budgetStore.checkAndStartOnboarding()...');
              await budgetStore.checkAndStartOnboarding();
            } else {
              console.log('⏭️ Skipping onboarding check (not verified or offline grace period)');
            }
          } else {
            console.log('🔄 Auth state: User is signed out');
          }
        });

        return unsubscribe;
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist basic auth state, Firebase handles the actual user session
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser, // Also persist user data for offline access
        lastAuthTime: state.lastAuthTime, // Persist auth timestamp for grace period
        offlineGracePeriod: state.offlineGracePeriod, // Persist grace period setting
        lastVerificationEmailSent: state.lastVerificationEmailSent // Persist verification email timestamp
      })
    }
  )
);
