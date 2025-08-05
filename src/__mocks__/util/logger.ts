import { vi } from 'vitest';

const mockLogger: any = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn((): any => mockLogger),
};

export default mockLogger;
export const getLogPath = vi.fn(() => "/mock/log/path");
export const getSessionId = vi.fn(() => "mock-session-id");