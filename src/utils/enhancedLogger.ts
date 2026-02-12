/**
 * Enhanced logging system with real-time log collection, filtering, and export capabilities
 */

export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  source: string;
  data?: any;
  userId?: string;
  sessionId: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs
  private sessionId: string;
  private subscribers: Set<(logs: LogEntry[]) => void> = new Set();

  constructor() {
    this.sessionId = this.generateSessionId();
    // Initialize with session start
    this.info('Logger', 'Session started', { sessionId: this.sessionId });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createEntry(level: LogLevel, source: string, message: string, data?: any): LogEntry {
    return {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      message,
      source,
      data,
      userId: this.getUserId(),
      sessionId: this.sessionId,
    };
  }

  private getUserId(): string | undefined {
    // Try to get current user ID from auth store or localStorage
    try {
      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.state?.user?.uid;
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    
    // Trim logs if we exceed max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify subscribers
    this.notifySubscribers();

    // Also log to console for development
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const levelName = levelNames[entry.level];
    const consoleMethod = entry.level === LOG_LEVELS.ERROR ? 'error' : 
                         entry.level === LOG_LEVELS.WARN ? 'warn' : 'log';
    
    console[consoleMethod](`[${levelName}] ${entry.source}: ${entry.message}`, entry.data || '');
  }

  private notifySubscribers(): void {
    const logsCopy = [...this.logs];
    this.subscribers.forEach(callback => callback(logsCopy));
  }

  debug(source: string, message: string, data?: any): void {
    this.addLog(this.createEntry(LOG_LEVELS.DEBUG, source, message, data));
  }

  info(source: string, message: string, data?: any): void {
    this.addLog(this.createEntry(LOG_LEVELS.INFO, source, message, data));
  }

  warn(source: string, message: string, data?: any): void {
    this.addLog(this.createEntry(LOG_LEVELS.WARN, source, message, data));
  }

  error(source: string, message: string, data?: any): void {
    this.addLog(this.createEntry(LOG_LEVELS.ERROR, source, message, data));
  }

  // Get logs with optional filtering
  getLogs(filters?: {
    level?: LogLevel;
    source?: string;
    search?: string;
    startTime?: number;
    endTime?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (filters?.level !== undefined) {
      filtered = filtered.filter(log => log.level >= filters.level!);
    }

    if (filters?.source) {
      filtered = filtered.filter(log => 
        log.source.toLowerCase().includes(filters.source!.toLowerCase())
      );
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(search) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(search))
      );
    }

    if (filters?.startTime) {
      filtered = filtered.filter(log => log.timestamp >= filters.startTime!);
    }

    if (filters?.endTime) {
      filtered = filtered.filter(log => log.timestamp <= filters.endTime!);
    }

    return filtered.reverse(); // Most recent first
  }

  // Subscribe to log updates
  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.subscribers.add(callback);
    callback([...this.logs]); // Send current logs immediately
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // Export logs to file
  exportLogs(filters?: {
    level?: LogLevel;
    source?: string;
    search?: string;
    startTime?: number;
    endTime?: number;
  }): string {
    const logs = this.getLogs(filters);
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      sessionId: this.sessionId,
      totalLogs: logs.length,
      logs: logs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp).toISOString(),
        level: ['DEBUG', 'INFO', 'WARN', 'ERROR'][log.level],
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Download logs as file
  downloadLogs(filters?: {
    level?: LogLevel;
    source?: string;
    search?: string;
    startTime?: number;
    endTime?: number;
  }): void {
    const data = this.exportLogs(filters);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-app-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Clear all logs
  clearLogs(): void {
    this.logs = [];
    this.notifySubscribers();
    this.info('Logger', 'Logs cleared');
  }

  // Get log statistics
  getStats(): {
    total: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
    sessionDuration: number;
  } {
    const byLevel: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    
    this.logs.forEach(log => {
      const levelName = levelNames[log.level];
      byLevel[levelName] = (byLevel[levelName] || 0) + 1;
      bySource[log.source] = (bySource[log.source] || 0) + 1;
    });

    const sessionDuration = this.logs.length > 0 ? 
      Date.now() - this.logs[0].timestamp : 0;

    return {
      total: this.logs.length,
      byLevel,
      bySource,
      sessionDuration,
    };
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;
