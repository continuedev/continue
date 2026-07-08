import { vi } from "vitest";

export const useService = vi.fn(() => ({
  value: null,
  state: "idle",
  error: null,
  reload: vi.fn(() => Promise.resolve()),
}));

export const useServices = vi.fn(() => ({
  services: {
    auth: { isAuthenticated: true },
    config: { config: { name: "test-assistant" } },
    model: { model: "test-model", llmApi: {} },
    mcp: {},
    apiClient: { apiClient: {} },
  },
  loading: false,
  error: null,
  allReady: true,
}));
