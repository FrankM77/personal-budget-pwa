import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wallet, List, Settings, HelpCircle } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
}

export const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      path: '/',
      label: 'Budget',
      icon: <Wallet className="w-6 h-6" />,
      enabled: true
    },
    {
      path: '/transactions',
      label: 'Transactions',
      icon: <List className="w-6 h-6" />,
      enabled: true
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: <Settings className="w-6 h-6" />,
      enabled: true
    },
    {
      path: '#',
      label: 'Future',
      icon: <HelpCircle className="w-6 h-6" />,
      enabled: false
    },
    {
      path: '#',
      label: 'Future',
      icon: <HelpCircle className="w-6 h-6" />,
      enabled: false
    }
  ];

  const handleNavigation = (path: string, enabled: boolean) => {
    if (enabled && path !== '#') {
      navigate(path);
    }
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 safe-area-inset-bottom z-50">
      <div className="flex justify-around items-center h-16 max-w-screen-xl mx-auto px-2">
        {navItems.map((item, index) => (
          <button
            key={index}
            onClick={() => handleNavigation(item.path, item.enabled)}
            disabled={!item.enabled}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              item.enabled
                ? isActive(item.path)
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
                : 'text-gray-300 dark:text-zinc-700 cursor-not-allowed'
            }`}
          >
            <div className={`transition-transform ${isActive(item.path) && item.enabled ? 'scale-110' : ''}`}>
              {item.icon}
            </div>
            <span className="text-xs mt-1 font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
