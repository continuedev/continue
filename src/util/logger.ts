import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import chalk from 'chalk';
import winston from 'winston';
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

// Simple replacer for JSON.stringify to handle common issues
function createReplacer() {
  const seen = new Set();
  
  return (key: string, value: any) => {
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    
    // Handle functions
    if (typeof value === 'function') {
      return '[Function]';
    }
    
    // Handle undefined (which JSON.stringify skips by default)
    if (value === undefined) {
      return '[undefined]';
    }
    
    return value;
  };
}

// Custom format for log output
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${SESSION_ID}] [${level}]: ${message}`;
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    try {
      msg += ` ${JSON.stringify(metadata, createReplacer())}`;
    } catch (err) {
      // Fallback if stringify still fails somehow
      msg += ` [Failed to stringify metadata: ${err}]`;
    }
  }
  
  // Add stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }
  
  return msg;
});

// Track headless mode
let isHeadlessMode = false;

// Create the logger instance
const winstonLogger = winston.createLogger({
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
  winstonLogger.level = level;
}

<<<<<<< HEAD
// Export logger methods
export default {
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
    sentryService.captureMessage(message, "warning", meta);
  },
||||||| 48adb23
// Export logger methods
export default {
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
=======
// Function to configure headless mode
export function configureHeadlessMode(headless: boolean) {
  isHeadlessMode = headless;
}

// Export logger methods  
export const logger = {
  debug: (message: string, meta?: any) => winstonLogger.debug(message, meta),
  info: (message: string, meta?: any) => winstonLogger.info(message, meta),
  warn: (message: string, meta?: any) => winstonLogger.warn(message, meta),
>>>>>>> main
  error: (message: string, error?: Error | any, meta?: any) => {
    if (error instanceof Error) {
<<<<<<< HEAD
      logger.error(message, { ...meta, error: error.message, stack: error.stack });
      sentryService.captureException(error, { message, ...meta });
||||||| 48adb23
      logger.error(message, { ...meta, error: error.message, stack: error.stack });
=======
      winstonLogger.error(message, { ...meta, error: error.message, stack: error.stack });
>>>>>>> main
    } else if (error) {
<<<<<<< HEAD
      logger.error(message, { ...meta, error });
      sentryService.captureMessage(`${message}: ${String(error)}`, "error", meta);
||||||| 48adb23
      logger.error(message, { ...meta, error });
=======
      winstonLogger.error(message, { ...meta, error });
>>>>>>> main
    } else {
<<<<<<< HEAD
      logger.error(message, meta);
      sentryService.captureMessage(message, "error", meta);
||||||| 48adb23
      logger.error(message, meta);
=======
      winstonLogger.error(message, meta);
    }
    
    // In headless mode, also output to stderr
    if (isHeadlessMode) {
      if (error instanceof Error) {
        console.error(chalk.red(`${message}: ${error.message}`));
      } else if (error) {
        console.error(chalk.red(`${message}: ${error}`));
      } else {
        console.error(chalk.red(message));
      }
>>>>>>> main
    }
  },
  setLevel: setLogLevel,
  configureHeadlessMode,
  getLogPath: getLogFilePath,
  getSessionId: () => SESSION_ID,
};