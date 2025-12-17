import { ContinueError, ContinueErrorReason, getRootCause } from './errors';

describe('getRootCause', () => {
  test('should return the error itself when it has no cause', () => {
    const err = new Error('This is an error');
    expect(getRootCause(err)).toBe(err);
  });

  test('should return the root cause of a nested error', () => {
    const rootCause = new Error('This is the root cause');
    const err = new Error('This is an error', { cause: rootCause });
    expect(getRootCause(err)).toBe(rootCause);
  });

  test('should return the root cause of a deeply nested error', () => {
    const rootCause = new Error('This is the root cause');
    const err1 = new Error('This is the first error', { cause: rootCause });
    const err2 = new Error('This is the second error', { cause: err1 });
    expect(getRootCause(err2)).toBe(rootCause);
  });
});

describe('ContinueError', () => {
  test('should correctly set the reason and message', () => {
    const reason = ContinueErrorReason.Unspecified;
    const message = 'This is a test error';
    const err = new ContinueError(reason, message);
    expect(err.reason).toBe(reason);
    expect(err.message).toBe(message);
    expect(err.name).toBe('ContinueError');
  });

  test('should have an empty message if none is provided', () => {
    const reason = ContinueErrorReason.Unspecified;
    const err = new ContinueError(reason);
    expect(err.reason).toBe(reason);
    expect(err.message).toBe("");
  });
});
