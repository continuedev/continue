import { vi } from "vitest";

export const logger: any = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn((): any => logger),
};
export const getLogPath = vi.fn(() => "/mock/log/path");
export const getSessionId = vi.fn(() => "mock-session-id");
