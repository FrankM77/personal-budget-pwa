import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../models/types';
import { validateCredentials } from '../config/users';

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  loginError: string | null;
  isLoading: boolean;
}

interface AuthActions {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,
      loginError: null,
      isLoading: false,

      login: async (username: string, password: string): Promise<boolean> => {
        set({ isLoading: true, loginError: null });

        try {
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 500));

          const user = validateCredentials(username, password);

          if (user) {
            set({
              currentUser: user,
              isAuthenticated: true,
              isLoading: false,
              loginError: null
            });
            console.log(`✅ User logged in: ${user.displayName} (${user.username})`);
            return true;
          } else {
            set({
              currentUser: null,
              isAuthenticated: false,
              isLoading: false,
              loginError: 'Invalid username or password'
            });
            return false;
          }
        } catch (error) {
          console.error('Login error:', error);
          set({
            currentUser: null,
            isAuthenticated: false,
            isLoading: false,
            loginError: 'Login failed. Please try again.'
          });
          return false;
        }
      },

      logout: () => {
        console.log('👋 User logged out');
        set({
          currentUser: null,
          isAuthenticated: false,
          loginError: null,
          isLoading: false
        });
      },

      clearError: () => {
        set({ loginError: null });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
