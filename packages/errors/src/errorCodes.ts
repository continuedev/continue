/**
 * Basic error codes used throughout the Continue application
 */
export const ErrorCodes = {
  // HTTP errors
  HTTP_ERROR: 'HTTP_ERROR',
  HTTP_BAD_REQUEST: 'HTTP_BAD_REQUEST',
  HTTP_UNAUTHORIZED: 'HTTP_UNAUTHORIZED',
  HTTP_FORBIDDEN: 'HTTP_FORBIDDEN',
  HTTP_NOT_FOUND: 'HTTP_NOT_FOUND',
  HTTP_RATE_LIMITED: 'HTTP_RATE_LIMITED',
  HTTP_INTERNAL_SERVER_ERROR: 'HTTP_INTERNAL_SERVER_ERROR',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',

  // Model errors
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  
  // Auth errors
  API_KEY_INVALID: 'API_KEY_INVALID',

  // Stream errors
  STREAM_ERROR: 'STREAM_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Map HTTP status codes to error codes
 */
export function getErrorCodeFromStatus(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return ErrorCodes.HTTP_BAD_REQUEST;
    case 401:
      return ErrorCodes.HTTP_UNAUTHORIZED;
    case 403:
      return ErrorCodes.HTTP_FORBIDDEN;
    case 404:
      return ErrorCodes.HTTP_NOT_FOUND;
    case 429:
      return ErrorCodes.HTTP_RATE_LIMITED;
    case 500:
      return ErrorCodes.HTTP_INTERNAL_SERVER_ERROR;
    default:
      return ErrorCodes.HTTP_ERROR;
  }
}