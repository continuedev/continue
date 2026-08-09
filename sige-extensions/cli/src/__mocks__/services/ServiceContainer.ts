import { vi } from "vitest";

export const serviceContainer = {
  get: vi.fn<(name: string) => any>(),
  set: vi.fn<(name: string, state: any) => void>(),
  has: vi.fn<(name: string) => boolean>(),
  reset: vi.fn<() => void>(),
  reload: vi.fn<(name: string) => Promise<void>>(),
};
