import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useBudgetStore } from '../../stores/budgetStore';
import { useNavigate } from 'react-router-dom';

export const UserMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { currentUser, logout } = useAuthStore();
  const { handleUserLogout } = useBudgetStore();
  const navigate = useNavigate();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    if (
      window.confirm(
        `Are you sure you want to log out? This will clear all your data from the app until you log back in.`
      )
    ) {
      try {
        handleUserLogout(); // Clear local data first
        logout(); // Clear auth state
        navigate('/');
        setIsOpen(false);
      } catch (error) {
        console.error('Logout failed:', error);
      }
    }
  };

  if (!currentUser) {
    return null;
  }

  const userInitial = currentUser.displayName?.charAt(0)?.toUpperCase() ||
                      currentUser.email?.charAt(0)?.toUpperCase() ||
                      'U';

  return (
    <div className="relative" ref={menuRef}>
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
          {userInitial}
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
          {currentUser.displayName || currentUser.email?.split('@')[0] || 'User'}
        </span>
        <ChevronDown 
          size={16} 
          className={`text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-800 overflow-hidden z-50">
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {currentUser.displayName || currentUser.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                navigate('/settings');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Settings size={18} className="text-gray-500 dark:text-gray-400" />
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
              <LogOut size={18} />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

