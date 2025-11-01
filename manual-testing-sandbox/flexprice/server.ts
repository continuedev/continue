import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';

// Load environment variables
config();

import {
  createConnection,
  getConnections,
  updateConnection,
  deleteConnection,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  SearchConnectionsRequest
} from './connections.js';

// Import refactored logger
import logger, { Logger } from './utils/logger.js';

// Import interceptors
import {
  requestInterceptor,
  responseInterceptor,
  errorInterceptor,
  performanceInterceptor,
  securityHeadersInterceptor,
  requestIdInterceptor,
  correlationIdInterceptor
} from './middleware/interceptors.js';

// Create context-specific loggers
const serverLogger = new Logger('Server');
const apiLogger = new Logger('API');
const authLogger = new Logger('Authentication');
const rateLimitLogger = new Logger('RateLimit');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable if conflicting with API responses
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply interceptors
app.use(requestIdInterceptor);
app.use(correlationIdInterceptor);
app.use(securityHeadersInterceptor);
app.use(requestInterceptor({
  logRequests: true,
  sanitizeHeaders: true,
  trackPerformance: true,
  customHeaders: {
    'X-Powered-By': 'Flexprice-SDK',
    'X-API-Version': '1.0.0'
  }
}));
app.use(responseInterceptor({
  logResponses: true,
  trackPerformance: true
}));
app.use(performanceInterceptor(1000)); // Warn if requests take > 1 second

// Request logging is now handled by interceptors

// Rate limiting configuration
const apiKeyRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator: (req: Request) => {
    // Use API key as primary identifier, fallback to IP
    const apiKey = req.header('x-api-key');
    return apiKey || req.ip;
  },
  handler: (req: Request, res: Response) => {
    rateLimitLogger.warn('Rate limit exceeded', {
      ip: req.ip,
      requestId: (req as any).requestId,
      url: req.url,
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000),
      requestId: (req as any).requestId
    });
  }
});

// Stricter rate limiting for write operations
const writeOperationsRateLimit = rateLimit({
  windowMs: parseInt(process.env.WRITE_RATE_LIMIT_WINDOW_MS || '300000'), // 5 minutes
  max: parseInt(process.env.WRITE_RATE_LIMIT_MAX || '20'), // 20 write operations per 5 minutes
  message: {
    error: 'Too many write operations',
    retryAfter: Math.ceil(parseInt(process.env.WRITE_RATE_LIMIT_WINDOW_MS || '300000') / 1000)
  },
  standardHeaders: true,
  keyGenerator: (req: Request) => {
    const apiKey = req.header('x-api-key');
    return apiKey || req.ip;
  },
  handler: (req: Request, res: Response) => {
    rateLimitLogger.warn('Write rate limit exceeded', {
      ip: req.ip,
      requestId: (req as any).requestId,
      operation: req.method,
      url: req.url
    });
    res.status(429).json({
      success: false,
      error: 'Too many write operations',
      message: 'Write operation rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(parseInt(process.env.WRITE_RATE_LIMIT_WINDOW_MS || '300000') / 1000),
      requestId: (req as any).requestId
    });
  }
});

// API key validation middleware
const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.header('x-api-key');
  const requestId = (req as any).requestId;

  if (!apiKey) {
    authLogger.warn('Request without API key', { 
      ip: req.ip, 
      url: req.url,
      requestId
    });
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'API key is required',
      requestId
    });
  }

  // Basic validation
  if (apiKey.length < 10) {
    authLogger.warn('Invalid API key format', { 
      ip: req.ip, 
      apiKeyLength: apiKey.length,
      requestId
    });
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
      message: 'API key format is invalid',
      requestId
    });
  }

  // Attach validated API key context
  (req as any).apiKeyValidated = true;
  
  authLogger.debug('API key validated', {
    requestId,
    url: req.url
  });

  next();
};

// Legacy error handler (now uses errorInterceptor)
const errorHandler = errorInterceptor;

// Input validation middleware
const validateRequestBody = (schema: Record<string, any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (value === undefined || value === null)) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          errors.push(`${field} must be of type ${rules.type}`);
        }

        if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`);
        }

        if (rules.enum && rules.enum.length && !rules.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
        }
      }
    }

    if (errors.length > 0) {
      apiLogger.debug('Request validation failed', { 
        errors, 
        requestId: (req as any).requestId,
        url: req.url 
      });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: errors.join(', '),
        errors,
        requestId: (req as any).requestId
      });
    }

    next();
  };
};

// Apply rate limiting
app.use('/api/', apiKeyRateLimit);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.post('/api/connections',
  validateApiKey,
  writeOperationsRateLimit,
  validateRequestBody({
    name: { required: true, type: 'string', minLength: 1 },
    provider_type: { required: true, type: 'string', enum: ['flexprice', 'stripe', 's3'] },
    sync_config: { required: true, type: 'object' }
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data: CreateConnectionRequest = req.body;
      const requestId = (req as any).requestId;
      
      apiLogger.sdkOperation('createConnection', { 
        providerType: data.provider_type,
        requestId
      });

      const result = await createConnection(data);

      apiLogger.info('Connection created successfully', { 
        connectionId: result.id,
        requestId
      });
      
      res.status(201).json({
        success: true,
        data: result,
        requestId
      });
    } catch (error: any) {
      apiLogger.error('Create connection failed', { 
        error: error.message,
        requestId: (req as any).requestId
      });
      next(error);
    }
  }
);

app.post('/api/connections/search',
  validateApiKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const searchParams: SearchConnectionsRequest = req.body;
      const requestId = (req as any).requestId;
      
      apiLogger.sdkOperation('searchConnections', { 
        filters: searchParams.filters?.length || 0,
        requestId
      });

      const result = await getConnections(searchParams);

      apiLogger.info('Connection search completed', { 
        count: result.connections.length,
        requestId
      });
      
      res.json({
        success: true,
        data: result,
        requestId
      });
    } catch (error: any) {
      apiLogger.error('Search connections failed', { 
        error: error.message,
        requestId: (req as any).requestId
      });
      next(error);
    }
  }
);

app.put('/api/connections/:id',
  validateApiKey,
  writeOperationsRateLimit,
  validateRequestBody({
    name: { type: 'string', minLength: 1 },
    metadata: { type: 'object' },
    sync_config: { type: 'object' }
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates: UpdateConnectionRequest = req.body;
      const requestId = (req as any).requestId;

      apiLogger.sdkOperation('updateConnection', { 
        connectionId: id, 
        updateFields: Object.keys(updates),
        requestId
      });

      const result = await updateConnection(id, updates);

      apiLogger.info('Connection updated successfully', { 
        connectionId: id,
        requestId
      });
      
      res.json({
        success: true,
        data: result,
        requestId
      });
    } catch (error: any) {
      apiLogger.error('Update connection failed', { 
        connectionId: req.params.id, 
        error: error.message,
        requestId: (req as any).requestId
      });
      next(error);
    }
  }
);

app.delete('/api/connections/:id',
  validateApiKey,
  writeOperationsRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const requestId = (req as any).requestId;

      apiLogger.sdkOperation('deleteConnection', { 
        connectionId: id,
        requestId
      });

      const result = await deleteConnection(id);

      apiLogger.info('Connection deleted successfully', { 
        connectionId: id,
        requestId
      });
      
      res.json({
        success: true,
        data: result,
        requestId
      });
    } catch (error: any) {
      apiLogger.error('Delete connection failed', { 
        connectionId: req.params.id, 
        error: error.message,
        requestId: (req as any).requestId
      });
      next(error);
    }
  }
);

// Apply error handling
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    serverLogger.info(`Flexprice Connections API server running on port ${PORT}`);
    serverLogger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    serverLogger.info(`Rate limit: ${process.env.RATE_LIMIT_MAX || '100'} requests per ${Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 60000)} minutes`);
    serverLogger.info('All Flexprice SDK interceptors active');
  });
}

export default app;