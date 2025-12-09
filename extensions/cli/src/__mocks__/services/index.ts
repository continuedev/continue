import { vi } from "vitest";

export const services = {
  auth: {
    login: vi.fn(() => Promise.resolve({})),
    logout: vi.fn(() => Promise.resolve({})),
    switchOrganization: vi.fn(() => Promise.resolve({})),
    getAvailableOrganizations: vi.fn(() => Promise.resolve([])),
  },
  toolPermissions: {
    isAllowed: vi.fn(() => Promise.resolve(true)),
    shouldAsk: vi.fn(() => Promise.resolve(false)),
    handleToolCall: vi.fn(() => Promise.resolve({ allowed: true })),
  },
  artifactUpload: {
    uploadArtifact: vi.fn(() =>
      Promise.resolve({ success: true, filename: "test.png" }),
    ),
    uploadArtifacts: vi.fn(() => Promise.resolve([])),
    getState: vi.fn(() => ({ uploadsInProgress: 0, lastError: null })),
  },
};

export const reloadService = vi.fn(() => Promise.resolve(undefined));

export const SERVICE_NAMES = {
  AUTH: "auth",
  CONFIG: "config",
  MODEL: "model",
  MCP: "mcp",
  API_CLIENT: "apiClient",
  TOOL_PERMISSIONS: "toolPermissions",
  FILE_INDEX: "fileIndex",
  RESOURCE_MONITORING: "resourceMonitoring",
  SYSTEM_MESSAGE: "systemMessage",
  CHAT_HISTORY: "chatHistory",
  UPDATE: "update",
  STORAGE_SYNC: "storageSync",
  AGENT_FILE: "agentFile",
  ARTIFACT_UPLOAD: "artifactUpload",
} as const;
