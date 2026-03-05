import { useAuthStore } from '../stores/authStore';

/**
 * Require an authenticated user. Throws if not logged in.
 * Shared helper used by all Zustand store slices.
 */
export const requireAuth = () => {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) throw new Error('No authenticated user found');
  return currentUser;
};
