import { describe, it, expect } from 'vitest';
import { ContinueError } from './ContinueError.js';

describe('ContinueError', () => {
  it('should create a basic error', () => {
    const error = new ContinueError('Test error');
    
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ContinueError');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof ContinueError).toBe(true);
  });

  it('should create an error with options', () => {
    const error = new ContinueError('Test error', {
      code: 'TEST_ERROR',
      requestId: 'req-123',
      statusCode: 400,
      metadata: { key: 'value' },
    });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.requestId).toBe('req-123');
    expect(error.statusCode).toBe(400);
    expect(error.metadata).toEqual({ key: 'value' });
  });

  it('should identify ContinueError instances', () => {
    const continueError = new ContinueError('Test');
    const regularError = new Error('Test');
    
    expect(ContinueError.isContinueError(continueError)).toBe(true);
    expect(ContinueError.isContinueError(regularError)).toBe(false);
    expect(ContinueError.isContinueError('string')).toBe(false);
  });

  it('should create from unknown error', () => {
    const originalError = new Error('Original');
    const continueError = ContinueError.fromUnknown(originalError, {
      code: 'CONVERTED',
      requestId: 'req-456',
    });

    expect(continueError.message).toBe('Original');
    expect(continueError.code).toBe('CONVERTED');
    expect(continueError.requestId).toBe('req-456');
    expect(continueError.originalError).toBe(originalError);
  });

  it('should create from HTTP response', () => {
    const mockResponse = {
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'x-request-id': 'req-789' }),
    };

    const error = ContinueError.fromHttpResponse(mockResponse);

    expect(error.statusCode).toBe(404);
    expect(error.requestId).toBe('req-789');
    expect(error.message).toContain('404');
    expect(error.code).toBe('HTTP_ERROR');
  });

  it('should serialize to JSON', () => {
    const error = new ContinueError('Test error', {
      code: 'TEST',
      requestId: 'req-123',
      statusCode: 500,
      metadata: { test: true },
    });

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'ContinueError',
      message: 'Test error',
      code: 'TEST',
      requestId: 'req-123',
      statusCode: 500,
      metadata: { test: true },
      stack: expect.any(String),
    });
  });

  it('should get user message from metadata', () => {
    const error = new ContinueError('Technical error', {
      metadata: { userMessage: 'User-friendly message' },
    });

    expect(error.getUserMessage()).toBe('User-friendly message');
  });

  it('should fallback to regular message for user message', () => {
    const error = new ContinueError('Regular message');

    expect(error.getUserMessage()).toBe('Regular message');
  });
});