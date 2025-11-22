import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { EnvelopeListView } from './views/EnvelopeListView';
// 1. ADD THIS IMPORT
import EnvelopeDetail from './views/EnvelopeDetail'; 

function App() {
  // State: Mimicking @State private var showingLaunchScreen
  const [showingLaunchScreen, setShowingLaunchScreen] = useState(true);

  // Effect: Mimicking .onAppear { DispatchQueue... }
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowingLaunchScreen(false);
    }, 2000); 
    return () => clearTimeout(timer);
  }, []);

  // Splash Screen View
  if (showingLaunchScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-blue-600 text-white">
        <div className="text-3xl font-bold animate-pulse">
          House Budget
        </div>
      </div>
    );
  }

  // Main App View
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EnvelopeListView />} />
        
        {/* 2. ADD THIS ROUTE */}
        <Route path="/envelope/:id" element={<EnvelopeDetail />} />
        
        <Route path="/settings" element={<div className="p-4">Settings Page Coming Soon</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;