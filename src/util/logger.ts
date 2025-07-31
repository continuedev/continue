import winston from 'winston';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import sentryService from '../sentry.js';

const { combine, timestamp, printf, errors } = winston.format;

// Generate a unique session ID for this process
const SESSION_ID = crypto.randomBytes(4).toString('hex');

// Get log directory
function getLogDir(): string {
  const homeDir = os.homedir();
  const logDir = path.join(homeDir, '.continue', 'logs');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  return logDir;
}

// Get current log file path
function getLogFilePath(): string {
  const logDir = getLogDir();
  return path.join(logDir, 'cn.log');
}

// Custom format for log output
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${SESSION_ID}] [${level}]: ${message}`;
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  
  // Add stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }
  
  return msg;
});

// Create the logger instance
const logger = winston.createLogger({
  level: 'info', // Default level
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  ),
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: getLogFilePath(),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Function to set log level
export function setLogLevel(level: string) {
  logger.level = level;
}

// Export logger methods
export default {
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
    sentryService.captureMessage(message, "warning", meta);
  },
  error: (message: string, error?: Error | any, meta?: any) => {
    if (error instanceof Error) {
      logger.error(message, { ...meta, error: error.message, stack: error.stack });
      sentryService.captureException(error, { message, ...meta });
    } else if (error) {
      logger.error(message, { ...meta, error });
      sentryService.captureMessage(`${message}: ${String(error)}`, "error", meta);
    } else {
      logger.error(message, meta);
      sentryService.captureMessage(message, "error", meta);
    }
  },
  setLevel: setLogLevel,
  getLogPath: getLogFilePath,
  getSessionId: () => SESSION_ID,
};