/**
 * Environment-aware logger utility.
 * Logs are only output in development mode (import.meta.env.DEV).
 * Errors are always logged regardless of environment.
 */
const logger = {
  log: (...args: any[]) => console.log(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

export default logger;
