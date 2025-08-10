import { vi } from "vitest";

export const log = vi.fn();
export const error = vi.fn();
export const info = vi.fn();
export const warn = vi.fn();
export const loggers = {
  blue: vi.fn(),
  green: vi.fn(),
  yellow: vi.fn(),
  red: vi.fn(),
  magenta: vi.fn(),
  cyan: vi.fn(),
  white: vi.fn(),
  gray: vi.fn(),
};
