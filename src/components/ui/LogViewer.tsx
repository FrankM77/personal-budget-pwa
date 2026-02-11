import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Filter, Download, Trash2, Search, ChevronDown, Clock, User, AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react';
import logger, { LOG_LEVELS, type LogEntry, type LogLevel } from '../../utils/enhancedLogger';

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filters, setFilters] = useState({
    level: undefined as LogLevel | undefined,
    source: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Lock body scroll when log viewer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // Subscribe to log updates
  useEffect(() => {
    const unsubscribe = logger.subscribe((newLogs: LogEntry[]) => {
      setLogs(newLogs);
      if (autoScroll) {
        // Auto-scroll to bottom when new logs arrive
        setTimeout(() => {
          const container = document.getElementById('log-container');
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }, 100);
      }
    });

    return unsubscribe;
  }, [autoScroll]);

  // Get filtered logs
  const filteredLogs = useMemo(() => {
    return logger.getLogs({
      level: filters.level,
      source: filters.source || undefined,
      search: filters.search || undefined,
    });
  }, [logs, filters]);

  // Get unique sources for filter dropdown
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    logs.forEach(log => sources.add(log.source));
    return Array.from(sources).sort();
  }, [logs]);

  // Get statistics
  const stats = useMemo(() => logger.getStats(), [logs]);

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  // Get level icon and color
  const getLevelInfo = (level: LogLevel) => {
    switch (level) {
      case LOG_LEVELS.DEBUG:
        return { icon: Bug, color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800' };
      case LOG_LEVELS.INFO:
        return { icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900' };
      case LOG_LEVELS.WARN:
        return { icon: AlertTriangle, color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-900' };
      case LOG_LEVELS.ERROR:
        return { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900' };
      default:
        return { icon: Info, color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800' };
    }
  };

  const handleExport = () => {
    logger.downloadLogs({
      level: filters.level,
      source: filters.source || undefined,
      search: filters.search || undefined,
    });
  };

  const handleClear = () => {
    logger.clearLogs();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-zinc-800 overscroll-contain"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Real-time Logs</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                <Clock className="w-4 h-4" />
                <span>{stats.total} entries</span>
                <span>•</span>
                <span>Session: {Math.floor(stats.sessionDuration / 1000)}s</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  autoScroll 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                    : 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                Auto-scroll
              </button>
              <button
                onClick={handleExport}
                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                title="Export logs"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleClear}
                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                title="Clear logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="border-b border-gray-200 dark:border-zinc-800">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {(filters.level !== undefined || filters.source || filters.search) && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full text-xs">
                    Active
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Level Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">
                        Level
                      </label>
                      <select
                        value={filters.level ?? ''}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          level: e.target.value ? Number(e.target.value) as LogLevel : undefined
                        }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                      >
                        <option value="">All Levels</option>
                        <option value={LOG_LEVELS.DEBUG}>Debug</option>
                        <option value={LOG_LEVELS.INFO}>Info</option>
                        <option value={LOG_LEVELS.WARN}>Warning</option>
                        <option value={LOG_LEVELS.ERROR}>Error</option>
                      </select>
                    </div>

                    {/* Source Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">
                        Source
                      </label>
                      <select
                        value={filters.source}
                        onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                      >
                        <option value="">All Sources</option>
                        {uniqueSources.map(source => (
                          <option key={source} value={source}>{source}</option>
                        ))}
                      </select>
                    </div>

                    {/* Search Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">
                        Search
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={filters.search}
                          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                          placeholder="Search messages..."
                          className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-zinc-400">
                    <span>Debug: {stats.byLevel.DEBUG || 0}</span>
                    <span>Info: {stats.byLevel.INFO || 0}</span>
                    <span>Warn: {stats.byLevel.WARN || 0}</span>
                    <span>Error: {stats.byLevel.ERROR || 0}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Log Entries */}
          <div 
            id="log-container"
            className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-sm overscroll-contain touch-pan-y"
            style={{ maxHeight: 'calc(90vh - 280px)' }}
          >
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-zinc-400">
                {logs.length === 0 ? 'No logs yet' : 'No logs match current filters'}
              </div>
            ) : (
              filteredLogs.map((log) => {
                const levelInfo = getLevelInfo(log.level);
                const Icon = levelInfo.icon;

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-start gap-3 p-2 rounded-lg ${levelInfo.bgColor} hover:opacity-80 transition-opacity`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${levelInfo.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 dark:text-zinc-400">
                          {formatTime(log.timestamp)}
                        </span>
                        <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                          {log.source}
                        </span>
                        {log.userId && (
                          <div className="w-3 h-3 text-gray-400 flex items-center justify-center" title={`User: ${log.userId}`}>
                            <User className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <div className="text-gray-900 dark:text-white break-words">
                        {log.message}
                      </div>
                      {log.data && (
                        <div className="mt-1 text-xs text-gray-600 dark:text-zinc-400 bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto">
                          <pre>{JSON.stringify(log.data, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LogViewer;
