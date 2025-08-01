/**
 * Standard error class for Continue application with enhanced metadata support
 */
export class ContinueError extends Error {
  public readonly code?: string;
  public readonly requestId?: string;
  public readonly statusCode?: number;
  public readonly metadata?: Record<string, any>;
  public readonly originalError?: unknown;

  constructor(
    message: string,
    options?: {
      code?: string;
      requestId?: string;
      statusCode?: number;
      metadata?: Record<string, any>;
      originalError?: unknown;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = "ContinueError";
    
    // Maintain prototype chain
    Object.setPrototypeOf(this, ContinueError.prototype);

    this.code = options?.code;
    this.requestId = options?.requestId;
    this.statusCode = options?.statusCode;
    this.metadata = options?.metadata;
    this.originalError = options?.originalError;
    
    if (options?.cause) {
      this.cause = options.cause;
    }

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContinueError);
    }
  }

  /**
   * Check if an error is a ContinueError instance
   */
  static isContinueError(error: unknown): error is ContinueError {
    return error instanceof ContinueError;
  }

  /**
   * Create a ContinueError from an unknown error
   */
  static fromUnknown(
    error: unknown,
    options?: {
      code?: string;
      requestId?: string;
      statusCode?: number;
      metadata?: Record<string, any>;
    }
  ): ContinueError {
    if (ContinueError.isContinueError(error)) {
      // If it's already a ContinueError, merge options
      return new ContinueError(error.message, {
        code: options?.code ?? error.code,
        requestId: options?.requestId ?? error.requestId,
        statusCode: options?.statusCode ?? error.statusCode,
        metadata: { ...error.metadata, ...options?.metadata },
        originalError: error.originalError,
        cause: error.cause as Error | undefined,
      });
    }

    if (error instanceof Error) {
      return new ContinueError(error.message, {
        ...options,
        originalError: error,
        cause: error,
      });
    }

    // Handle non-Error objects
    const message = typeof error === 'string' ? error : 'Unknown error occurred';
    return new ContinueError(message, {
      ...options,
      originalError: error,
    });
  }

  /**
   * Create a ContinueError for HTTP-related errors
   */
  static fromHttpResponse(
    response: { status: number; statusText?: string; headers?: Headers | Record<string, string> },
    message?: string,
    options?: {
      code?: string;
      metadata?: Record<string, any>;
      originalError?: unknown;
    }
  ): ContinueError {
    const requestId = response.headers instanceof Headers 
      ? response.headers.get('x-request-id')
      : response.headers?.['x-request-id'];

    return new ContinueError(
      message || `HTTP ${response.status}: ${response.statusText || 'Request failed'}`,
      {
        code: options?.code || 'HTTP_ERROR',
        requestId: requestId || undefined,
        statusCode: response.status,
        metadata: {
          statusText: response.statusText,
          ...options?.metadata,
        },
        originalError: options?.originalError,
      }
    );
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    // If metadata contains a user message, use that
    if (this.metadata?.userMessage && typeof this.metadata.userMessage === 'string') {
      return this.metadata.userMessage;
    }

    // Otherwise, return the regular message
    return this.message;
  }

  /**
   * Convert to a plain object for serialization
   */
  toJSON(): {
    name: string;
    message: string;
    code?: string;
    requestId?: string;
    statusCode?: number;
    metadata?: Record<string, any>;
    stack?: string;
  } {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      requestId: this.requestId,
      statusCode: this.statusCode,
      metadata: this.metadata,
      stack: this.stack,
    };
  }
}