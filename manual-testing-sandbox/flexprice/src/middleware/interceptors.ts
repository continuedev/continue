import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';

const logger = new Logger('Interceptors');

/**
 * Request/Response Interceptor Configuration
 */
export interface InterceptorConfig {
  logRequests?: boolean;
  logResponses?: boolean;
  sanitizeHeaders?: boolean;
  trackPerformance?: boolean;
  customHeaders?: Record<string, string>;
}

/**
 * Request Interceptor
 * Captures and logs incoming requests with Flexprice SDK context
 */
export const requestInterceptor = (config: InterceptorConfig = {}) => {
  const {
    logRequests = true,
    sanitizeHeaders = true,
    trackPerformance = true,
    customHeaders = {}
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    // Attach request metadata
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    (req as any).requestId = requestId;
    (req as any).startTime = Date.now();

    // Add custom headers to response
    Object.entries(customHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Add request ID header
    res.setHeader('X-Request-ID', requestId);

    if (logRequests) {
      const sanitizedHeaders = sanitizeHeaders
        ? sanitizeSensitiveData(req.headers)
        : req.headers;

      logger.apiRequest(req.method, req.url, {
        requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        headers: sanitizedHeaders,
        query: req.query,
        body: sanitizeHeaders ? sanitizeSensitiveData(req.body) : req.body
      });
    }

    next();
  };
};

/**
 * Response Interceptor
 * Captures and logs outgoing responses with performance metrics
 */
export const responseInterceptor = (config: InterceptorConfig = {}) => {
  const {
    logResponses = true,
    trackPerformance = true
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    // Capture original send function
    const originalSend = res.send;
    const originalJson = res.json;

    // Override send method
    res.send = function (data: any): Response {
      logResponse(req, res, data);
      return originalSend.call(this, data);
    };

    // Override json method
    res.json = function (data: any): Response {
      logResponse(req, res, data);
      return originalJson.call(this, data);
    };

    function logResponse(req: Request, res: Response, data: any) {
      if (logResponses) {
        const duration = trackPerformance && (req as any).startTime
          ? Date.now() - (req as any).startTime
          : 0;

        logger.apiResponse(req.method, req.url, res.statusCode, duration, {
          requestId: (req as any).requestId,
          contentType: res.get('Content-Type'),
          contentLength: res.get('Content-Length') || (data ? JSON.stringify(data).length : 0),
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      }
    }

    next();
  };
};

/**
 * Error Interceptor
 * Captures and formats errors with Flexprice SDK context
 */
export const errorInterceptor = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId || 'unknown';
  const duration = (req as any).startTime ? Date.now() - (req as any).startTime : 0;

  // Log the error
  logger.error('Request error occurred', {
    requestId,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    method: req.method,
    url: req.url,
    ip: req.ip,
    duration
  });

  // Determine error status code
  const statusCode = (err as any).statusCode || (err as any).status || 500;

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
      code: (err as any).code || 'INTERNAL_SERVER_ERROR',
      requestId,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Performance Monitoring Interceptor
 * Tracks and logs performance metrics for Flexprice SDK operations
 */
export const performanceInterceptor = (threshold: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (duration > threshold) {
        logger.warn('Slow request detected', {
          requestId: (req as any).requestId,
          method: req.method,
          url: req.url,
          duration,
          threshold,
          statusCode: res.statusCode
        });
      }

      // Log performance metrics
      if (process.env.LOG_LEVEL === 'debug') {
        logger.debug('Request performance', {
          requestId: (req as any).requestId,
          method: req.method,
          url: req.url,
          duration,
          statusCode: res.statusCode,
          contentLength: res.get('Content-Length')
        });
      }
    });

    next();
  };
};

/**
 * Security Headers Interceptor
 * Adds security headers to all responses for Flexprice SDK protection
 */
export const securityHeadersInterceptor = (req: Request, res: Response, next: NextFunction) => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Remove powered-by header
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Request ID Interceptor
 * Ensures all requests have a unique ID for tracing through Flexprice SDK
 */
export const requestIdInterceptor = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.get('X-Request-ID') || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
};

/**
 * Sanitize sensitive data from objects
 */
function sanitizeSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sensitiveKeys = [
    'password',
    'token',
    'apikey',
    'api-key',
    'x-api-key',
    'authorization',
    'secret',
    'credential',
    'private'
  ];

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeSensitiveData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Correlation ID Interceptor
 * Tracks requests across multiple Flexprice SDK services
 */
export const correlationIdInterceptor = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.get('X-Correlation-ID') || 
    `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  logger.debug('Correlation ID assigned', {
    correlationId,
    requestId: (req as any).requestId,
    url: req.url
  });

  next();
};

export default {
  requestInterceptor,
  responseInterceptor,
  errorInterceptor,
  performanceInterceptor,
  securityHeadersInterceptor,
  requestIdInterceptor,
  correlationIdInterceptor
};
```