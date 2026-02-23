import crypto from "crypto";
import fs from "fs";
import path from "path";

import chalk from "chalk";
import winston from "winston";

import { env } from "../env.js";
import { sentryService } from "../sentry.js";

const { combine, timestamp, printf, errors } = winston.format;

// Generate a unique session ID for this process
const SESSION_ID = crypto.randomBytes(4).toString("hex");

// Get log directory
function getLogDir(): string {
  const logDir = path.join(env.continueHome, "logs");

  // Create directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return logDir;
}

// Get current log file path
function getLogFilePath(): string {
  const logDir = getLogDir();
  return path.join(logDir, "cn.log");
}

// Simple replacer for JSON.stringify to handle common issues
function createReplacer() {
  const seen = new Set();

  return (key: string, value: any) => {
    // Handle circular references
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }

    // Handle Error objects explicitly - extract useful properties
    if (value instanceof Error) {
      const errorObj: any = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
      if (value.cause) {
        errorObj.cause = value.cause;
      }
      return errorObj;
    }

    // Handle functions
    if (typeof value === "function") {
      return "[Function]";
    }

    // Handle undefined (which JSON.stringify skips by default)
    if (value === undefined) {
      return "[undefined]";
    }

    return value;
  };
}

// Custom format for log output
const logFormat = printf(
  ({ level, message, timestamp, stack, ...metadata }) => {
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
  },
);

// Track headless mode
let isHeadlessMode = false;
let isTTYlessEnvironment = false;

// Create the winstonLogger instance
const winstonLogger = winston.createLogger({
  level: "info", // Default level
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    logFormat,
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

// Function to configure headless mode
export function configureHeadlessMode(headless: boolean) {
  isHeadlessMode = headless;

  // Detect TTY-less environment
  isTTYlessEnvironment =
    process.stdin.isTTY !== true &&
    process.stdout.isTTY !== true &&
    process.stderr.isTTY !== true;

  // In TTY-less environments with headless mode, ensure output is line-buffered
  if (headless && isTTYlessEnvironment) {
    // Set encoding for consistent output
    if (process.stdout.setDefaultEncoding) {
      process.stdout.setDefaultEncoding("utf8");
    }
    if (process.stderr.setDefaultEncoding) {
      process.stderr.setDefaultEncoding("utf8");
    }
  }
}

// Export winstonLogger methods
export const logger = {
  debug: (message: string, meta?: any) => winstonLogger.debug(message, meta),
  info: (message: string, meta?: any) => winstonLogger.info(message, meta),
  warn: (message: string, meta?: any) => {
    winstonLogger.warn(message, meta);
    sentryService.captureMessage(message, "warning", meta);
  },
  error: (message: string, error?: Error | any, meta?: any) => {
    if (error instanceof Error) {
      winstonLogger.error(message, {
        ...meta,
        error: error.message,
        stack: error.stack,
      });
      sentryService.captureException(error, { message, ...meta });
    } else if (error) {
      winstonLogger.error(message, { ...meta, error });
      sentryService.captureMessage(
        `${message}: ${String(error)}`,
        "error",
        meta,
      );
    } else {
      winstonLogger.error(message, meta);
      sentryService.captureMessage(message, "error", meta);
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
    }
  },
  setLevel: setLogLevel,
  configureHeadlessMode,
  getLogPath: getLogFilePath,
  getSessionId: () => SESSION_ID,
};
