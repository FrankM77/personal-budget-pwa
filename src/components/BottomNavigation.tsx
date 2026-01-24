import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wallet, List, Settings, Plus, MoreHorizontal, BarChart3, TrendingUp, PieChart } from 'lucide-react';

interface BottomNavigationProps {
  onAddTransaction?: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ onAddTransaction }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // More menu items
  const moreMenuItems = [
    { path: '/reports', icon: <BarChart3 className="w-5 h-5" />, label: 'Reports' },
    { path: '/analytics', icon: <TrendingUp className="w-5 h-5" />, label: 'Analytics' },
    { path: '/budget-breakdown', icon: <PieChart className="w-5 h-5" />, label: 'Budget Breakdown' },
  ];

  // Reusable Nav Button Component
  const NavButton = ({ path, icon, label }: { path: string; icon: React.ReactNode; label: string }) => {
    const active = isActive(path);
    return (
      <button
        onClick={() => navigate(path)}
        className={`
          relative group flex flex-col items-center justify-center
          w-12 h-12 rounded-2xl transition-all duration-300
          ${active 
            ? 'text-blue-500 bg-blue-50 dark:bg-blue-500/20 dark:text-blue-400' 
            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }
        `}
      >
        <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
          {icon}
        </div>
        <span className="sr-only">{label}</span>
        
        {/* Active Indicator Dot */}
        {active && (
          <div className="absolute -bottom-1 w-1 h-1 bg-current rounded-full opacity-80" />
        )}
      </button>
    );
  };

  return (
    // Container: Positions the dock and passes clicks through empty space
    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none safe-area-inset-bottom">
      
      {/* The Dock Itself */}
      <nav className="
        pointer-events-auto
        flex items-center gap-1 p-2 pl-4 pr-4
        bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl
        border border-zinc-200/30 dark:border-zinc-800/30
        rounded-full shadow-2xl shadow-zinc-900/10
        transform transition-all duration-500 ease-out
      ">
        
        {/* Left Side */}
        <NavButton path="/" label="Budget" icon={<Wallet className="w-6 h-6" />} />
        <NavButton path="/transactions" label="Transactions" icon={<List className="w-6 h-6" />} />

        {/* Divider */}
        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 mx-2" />

        {/* CENTRAL ACTION BUTTON (Floating +) */}
        <button
          onClick={() => {
            setShowMoreMenu(false);
            if (onAddTransaction) {
              onAddTransaction();
              return;
            }
            navigate('/add-transaction');
          }}
          className="
            -mt-8 mb-2 mx-1
            group relative flex items-center justify-center
            w-16 h-16 rounded-full
            bg-blue-600 text-white
            shadow-xl shadow-blue-600/30
            hover:shadow-blue-600/50 hover:scale-105 hover:-translate-y-1
            active:scale-95 active:translate-y-0
            transition-all duration-300 cubic-bezier(0.175, 0.885, 0.32, 1.275)
          "
        >
          <Plus className="w-8 h-8 transition-transform duration-300 group-hover:rotate-90" />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 mx-2" />

        {/* Right Side */}
        {/* More Menu Button */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`
              relative group flex flex-col items-center justify-center
              w-12 h-12 rounded-2xl transition-all duration-300
              ${showMoreMenu 
                ? 'text-blue-500 bg-blue-50 dark:bg-blue-500/20 dark:text-blue-400' 
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }
            `}
          >
            <div className={`transition-transform duration-300 ${showMoreMenu ? 'scale-110' : 'group-hover:scale-105'}`}>
              <MoreHorizontal className="w-6 h-6" />
            </div>
            <span className="sr-only">More</span>
            
            {/* Active Indicator Dot */}
            {showMoreMenu && (
              <div className="absolute -bottom-1 w-1 h-1 bg-current rounded-full opacity-80" />
            )}
          </button>

          {/* More Menu Dropdown */}
          {showMoreMenu && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowMoreMenu(false)}
              />
              
              {/* Menu */}
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 backdrop-blur-xl z-50">
                <div className="p-2">
                  {moreMenuItems.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        navigate(item.path);
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                    >
                      <div className="text-zinc-600 dark:text-zinc-400">
                        {item.icon}
                      </div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        
        <NavButton path="/settings" label="Settings" icon={<Settings className="w-6 h-6" />} />

      </nav>
    </div>
  );
};
