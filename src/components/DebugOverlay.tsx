import React, { useState, useEffect } from 'react';
import { Bug } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'log' | 'warn' | 'error';
}

// Global log storage that persists across component mounts
let globalLogs: LogEntry[] = [];
let isLoggerActive = false;

  const addGlobalLog = (message: string, type: 'log' | 'warn' | 'error') => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      message: message,
      type
    };

    globalLogs = [entry, ...globalLogs].slice(0, 100); // Keep last 100 logs
  };

  // Initialize global logger immediately
  if (!isLoggerActive && typeof window !== 'undefined') {
    isLoggerActive = true;
    
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const formatArgs = (args: any[]) => {
      return args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
    };

    console.log = (...args) => {
      originalLog(...args);
      addGlobalLog(formatArgs(args), 'log');
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addGlobalLog(formatArgs(args), 'warn');
    };

    console.error = (...args) => {
      originalError(...args);
      addGlobalLog(formatArgs(args), 'error');
    };
  }

/**
 * Debug overlay for mobile testing - shows recent console logs
 * Toggle by tapping the bug icon in bottom-right corner
 */
export const DebugOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Load existing logs from global storage
    setLogs([...globalLogs]);
  }, [isVisible]); // Refresh when opening

  // Add test log on mount to verify it's working
  useEffect(() => {
    if (isVisible) {
      console.log('🐛 Debug Console: Opened and ready to capture logs');
      // Test all log types
      console.warn('🐛 Debug Console: Test warning message');
      console.error('🐛 Debug Console: Test error message');
    }
  }, [isVisible]);

  const clearLogs = () => {
    globalLogs = [];
    setLogs([]);
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-20 right-4 z-[9999] bg-blue-500 text-white p-2 rounded-full shadow-lg border-2 border-white"
        style={{ width: '48px', height: '48px' }}
        title="Debug Console"
      >
        <Bug className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm"
      onClick={() => setIsVisible(false)} // Tap outside to close
    >
      <div className="h-full flex flex-col" onClick={(e) => e.stopPropagation()}> {/* Prevent close when clicking content */}
        {/* Header */}
        <div className="bg-gray-900 text-white p-4 flex items-center">
          <h3 className="text-lg font-semibold">Debug Console</h3>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-2 pb-20">
          {logs.length === 0 ? (
            <div className="text-gray-400 text-center mt-8">No logs yet</div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`text-xs font-mono p-2 rounded ${
                    log.type === 'error'
                      ? 'bg-red-900/50 text-red-200'
                      : log.type === 'warn'
                      ? 'bg-yellow-900/50 text-yellow-200'
                      : 'bg-gray-800 text-gray-200'
                  }`}
                >
                  <div className="opacity-60">{log.timestamp}</div>
                  <div className="break-words">{log.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Controls - Easy to reach on iOS */}
        <div className="bg-gray-900 border-t border-gray-700 p-4 flex gap-2">
          <button
            onClick={() => {
              console.log('🐛 Manual test log - this should appear in debug console');
              console.warn('🐛 Manual test warning');
              setLogs([...globalLogs]);
            }}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded text-sm"
          >
            Test Log
          </button>
          <button
            onClick={() => setLogs([...globalLogs])}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            Refresh
          </button>
          <button
            onClick={clearLogs}
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded text-sm"
          >
            Clear
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
