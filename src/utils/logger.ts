/**
 * Legacy logger wrapper — pipes all calls into the enhanced logging system.
 * Maintains backward compatibility with existing logger.log/warn/error calls
 * while feeding everything into the LogViewer.
 */
import enhancedLogger from './enhancedLogger';

function extractSource(firstArg: any): { source: string; message: string; data?: any } {
  if (typeof firstArg === 'string') {
    // Try to extract source from emoji-prefixed strings like "🎙️ Siri: message"
    const emojiMatch = firstArg.match(/^[^\w]*\s*([A-Za-z]+):\s*(.*)/);
    if (emojiMatch) {
      return { source: emojiMatch[1], message: emojiMatch[2] };
    }
    return { source: 'App', message: firstArg };
  }
  return { source: 'App', message: String(firstArg) };
}

const logger = {
  log: (...args: any[]) => {
    const { source, message } = extractSource(args[0]);
    const data = args.length > 1 ? (args.length === 2 ? args[1] : args.slice(1)) : undefined;
    enhancedLogger.info(source, message, data);
  },
  warn: (...args: any[]) => {
    const { source, message } = extractSource(args[0]);
    const data = args.length > 1 ? (args.length === 2 ? args[1] : args.slice(1)) : undefined;
    enhancedLogger.warn(source, message, data);
  },
  error: (...args: any[]) => {
    const { source, message } = extractSource(args[0]);
    const data = args.length > 1 ? (args.length === 2 ? args[1] : args.slice(1)) : undefined;
    enhancedLogger.error(source, message, data);
  },
};

export default logger;
