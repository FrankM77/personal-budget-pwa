/**
 * Environment-aware logger utility.
 * Logs are only output in development mode (import.meta.env.DEV).
 * Errors are always logged regardless of environment.
 */
const isDev = import.meta.env.DEV;

const logger = {
  log: (...args: any[]) => { if (isDev) console.log(...args); },
  warn: (...args: any[]) => { if (isDev) console.warn(...args); },
  error: (...args: any[]) => console.error(...args),
};

export default logger;
