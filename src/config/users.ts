import type { User } from '../models/types';

// Simple hash function for demo purposes (NOT secure for production)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
};

// Predefined users for the simple multi-user login system
export const PREDEFINED_USERS: User[] = [
  {
    id: 'user-frank',
    username: 'frank',
    displayName: 'Frank',
    passwordHash: simpleHash('password123') // frank:password123
  },
  {
    id: 'user-brother',
    username: 'brother',
    displayName: 'Brother',
    passwordHash: simpleHash('password123') // brother:password123
  }
];

export const getUserByUsername = (username: string): User | undefined => {
  return PREDEFINED_USERS.find(user => user.username === username);
};

export const validateCredentials = (username: string, password: string): User | null => {
  const user = getUserByUsername(username);
  if (user && simpleHash(password) === user.passwordHash) {
    return user;
  }
  return null;
};
