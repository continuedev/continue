import { vi } from "vitest";

export const services = {
  auth: {
    login: vi.fn(() => Promise.resolve({})),
    logout: vi.fn(() => Promise.resolve({})),
    switchOrganization: vi.fn(() => Promise.resolve({})),
    getAvailableOrganizations: vi.fn(() => Promise.resolve([])),
  },
};

export const reloadService = vi.fn(() => Promise.resolve(undefined));

export const SERVICE_NAMES = {
  AUTH: "auth",
  API_CLIENT: "apiClient",
  CONFIG: "config",
  MODEL: "model",
  MCP: "mcp",
};
