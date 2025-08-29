import winston from "winston";
import { captureException } from "./sentry/SentryLogger";

class LoggerClass {
  private static instance: LoggerClass;
  private winston: winston.Logger;

  private constructor() {
    this.winston = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `[@continuedev] ${level}: ${message}${metaStr}`;
        }),
      ),
      transports: [
        // Write all logs with importance level of `info` or higher to `info.log`
        ...(process.env.NODE_ENV === "test"
          ? [
              new winston.transports.File({
                filename: "e2e.log",
                level: "info",
              }),
            ]
          : []),
        // Normal console.log behavior
        new winston.transports.Console(),
      ],
    });
  }

  public static getInstance(): LoggerClass {
    if (!LoggerClass.instance) {
      LoggerClass.instance = new LoggerClass();
    }
    return LoggerClass.instance;
  }

  private shouldSendToSentry(): boolean {
    return process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "e2e";
  }

  public log(message: string, meta?: any): void {
    this.winston.info(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.winston.debug(message, meta);
  }

  public info(message: string, meta?: any): void {
    this.winston.info(message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.winston.warn(message, meta);
  }

  public error(
    error: Error | string | unknown,
    context?: Record<string, any>,
  ): void {
    let errorMessage: string;

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else {
      errorMessage = "An unknown error occurred";
    }

    this.winston.error(errorMessage, context);

    if (this.shouldSendToSentry() && error instanceof Error) {
      captureException(error, context);
    }
  }
}

export const Logger = LoggerClass.getInstance();
