import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { EnvelopeListView } from './views/EnvelopeListView';
// 1. ADD THIS IMPORT
import EnvelopeDetail from './views/EnvelopeDetail';
import { SettingsView } from './views/SettingsView';
import { AddEnvelopeView } from './views/AddEnvelopeView';
import { AddTransactionView } from './views/AddTransactionView';
import { TransactionHistoryView } from './views/TransactionHistoryView';
import { Toast } from './components/ui/Toast';
import { useEnvelopeStore } from './stores/envelopeStore';

function App() {
  // State: Mimicking @State private var showingLaunchScreen
  const [showingLaunchScreen, setShowingLaunchScreen] = useState(true);
  const { appSettings } = useEnvelopeStore();

  // Effect: Mimicking .onAppear { DispatchQueue... }
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowingLaunchScreen(false);
    }, 2000); 
    return () => clearTimeout(timer);
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

  // Splash Screen View
  if (showingLaunchScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-blue-600 text-white dark:bg-black">
        <div className="text-3xl font-bold animate-pulse">
          House Budget
        </div>
      </div>
    );
  }

  // Main App View
  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<EnvelopeListView />} />

          {/* 2. ADD THIS ROUTE */}
          <Route path="/envelope/:id" element={<EnvelopeDetail />} />
          <Route path="/add-envelope" element={<AddEnvelopeView />} />
          <Route path="/add-transaction" element={<AddTransactionView />} />
          {/* Inside your App.tsx Router configuration */}
          <Route path="/transactions" element={<TransactionHistoryView />} />

          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </HashRouter>

      {/* Global Toast Notifications */}
      <Toast />
    </>
  );
}

export default App;