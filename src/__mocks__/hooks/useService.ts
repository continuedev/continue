import { jest } from "@jest/globals";

export const useService = jest.fn(() => ({
  value: null,
  state: "idle",
  error: null,
  reload: jest.fn(() => Promise.resolve()),
}));

export const useServices = jest.fn(() => ({
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