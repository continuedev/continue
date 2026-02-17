import { IdeInfo } from "../../index.js";

export class SentryLogger {
  static async setup(
    _allowAnonymousTelemetry: boolean,
    _uniqueId: string,
    _ideInfo: IdeInfo,
    _userEmail?: string,
  ) {}

  static shutdownSentryClient() {}
}

export function initializeSentry(): {
  client: undefined;
  scope: undefined;
} {
  return { client: undefined, scope: undefined };
}

export function createSpan<T>(
  _operation: string,
  _name: string,
  callback: () => T | Promise<T>,
): T | Promise<T> {
  return callback();
}

export function captureException(
  _error: Error,
  _context?: Record<string, any>,
) {}

export function captureLog(
  _message: string,
  _level?: string,
  _context?: Record<string, any>,
) {}
