import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';
import type { User } from '../models/types';

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  loginError: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  isInitializing?: boolean; // For internal use during initialization
}

interface AuthActions {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<boolean>;
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

      login: async (email: string, password: string): Promise<boolean> => {
        set({ isLoading: true, loginError: null });

        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;
          const user = firebaseUserToUser(firebaseUser);

          set({
            currentUser: user,
            isAuthenticated: true,
            isLoading: false,
            loginError: null
          });
          console.log(`✅ User logged in: ${user.email}`);
          return true;
        } catch (error: any) {
          console.error('Login error:', error);
          let errorMessage = 'Login failed. Please try again.';

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

          const user = firebaseUserToUser(firebaseUser);

          set({
            currentUser: user,
            isAuthenticated: true,
            isLoading: false,
            loginError: null
          });
          console.log(`✅ User registered and logged in: ${user.email}`);
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

      initializeAuth: () => {
        set({ isInitialized: false });

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          const user = firebaseUser ? firebaseUserToUser(firebaseUser) : null;

          set({
            currentUser: user,
            isAuthenticated: !!user,
            isInitialized: true,
            isLoading: false,
            loginError: null
          });

          if (user) {
            console.log(`🔄 Auth state: User is signed in (${user.email})`);
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
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
