import winston from 'winston';
import path from 'path';
import fs from 'fs';

/**
 * Flexprice SDK Logger Utility
 * Provides structured logging with multiple transports and log levels
 */

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const customFormat = winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'flexprice-connections-server' },
  transports: [
    // Console transport with colorization for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    })
  ]
});

// Add file transports for production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'server-error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );

  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'server-combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

/**
 * Logger wrapper with additional utility methods
 */
export class Logger {
  private context: string;

  constructor(context: string = 'default') {
    this.context = context;
  }

  private formatMessage(message: string, meta?: Record<string, any>) {
    return {
      message,
      context: this.context,
      ...meta
    };
  }

  info(message: string, meta?: Record<string, any>) {
    logger.info(this.formatMessage(message, meta));
  }

  error(message: string, meta?: Record<string, any>) {
    logger.error(this.formatMessage(message, meta));
  }

  warn(message: string, meta?: Record<string, any>) {
    logger.warn(this.formatMessage(message, meta));
  }

  debug(message: string, meta?: Record<string, any>) {
    logger.debug(this.formatMessage(message, meta));
  }

  verbose(message: string, meta?: Record<string, any>) {
    logger.verbose(this.formatMessage(message, meta));
  }

  /**
   * Log Flexprice SDK specific operations
   */
  sdkOperation(operation: string, meta?: Record<string, any>) {
    this.info(`Flexprice SDK Operation: ${operation}`, {
      ...meta,
      sdkOperation: true
    });
  }

  /**
   * Log API requests
   */
  apiRequest(method: string, url: string, meta?: Record<string, any>) {
    this.info(`API Request: ${method} ${url}`, {
      ...meta,
      apiRequest: true
    });
  }

  /**
   * Log API responses
   */
  apiResponse(method: string, url: string, statusCode: number, duration: number, meta?: Record<string, any>) {
    this.info(`API Response: ${method} ${url} - ${statusCode}`, {
      ...meta,
      statusCode,
      duration,
      apiResponse: true
    });
  }
}

export default new Logger('FlexpriceServer');