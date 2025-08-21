import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { AssistantConfig } from "@continuedev/sdk";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { AuthConfig } from "../auth/workos.js";
import { PermissionMode, ToolPermissions } from "../permissions/types.js";

import { MCPService } from "./MCPService.js";

/**
 * Service lifecycle states
 */
export type ServiceState = "idle" | "loading" | "ready" | "error";

/**
 * Generic service result with state tracking
 */
export interface ServiceResult<T> {
  value: T | null;
  state: ServiceState;
  error: Error | null;
  lastUpdated?: Date;
}

/**
 * Service event types for the EventEmitter
 */
export interface ServiceEvents {
  [key: `${string}:loading`]: [];
  [key: `${string}:ready`]: [any];
  [key: `${string}:error`]: [Error];
  [key: `${string}:changed`]: [any];
}

/**
 * Core service types
 */
export interface AuthServiceState {
  authConfig: AuthConfig | null;
  isAuthenticated: boolean;
  organizationId?: string;
}

export interface ConfigServiceState {
  config: AssistantUnrolled | null;
  configPath?: string;
}

export interface ModelServiceState {
  llmApi: BaseLlmApi | null;
  model: ModelConfig | null;
}

export type MCPServerStatus = "idle" | "connecting" | "connected" | "error";
export type MCPTool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];
export type MCPPrompt = Awaited<
  ReturnType<Client["listPrompts"]>
>["prompts"][number];
export type MCPServerConfig = NonNullable<
  NonNullable<AssistantConfig["mcpServers"]>[number]
>;

export interface MCPConnectionInfo {
  config: MCPServerConfig;
  status: MCPServerStatus;
  tools: MCPTool[];
  prompts: MCPPrompt[];
  error?: string;
  warnings: string[];
}

export interface MCPServiceState {
  mcpService: MCPService | null;
  connections: Array<MCPConnectionInfo>;
  tools: MCPTool[];
  prompts: MCPPrompt[];
}

export interface ApiClientServiceState {
  apiClient: DefaultApiInterface | null;
}

export interface ToolPermissionServiceState {
  permissions: ToolPermissions;
  currentMode: PermissionMode;
  modePolicyCount?: number;
  originalPolicies?: ToolPermissions;
}

export type { FileIndexServiceState } from "./FileIndexService.js";

/**
 * Service names as constants to prevent typos
 */
export const SERVICE_NAMES = {
  AUTH: "auth",
  CONFIG: "config",
  MODEL: "model",
  MCP: "mcp",
  API_CLIENT: "apiClient",
  TOOL_PERMISSIONS: "toolPermissions",
  FILE_INDEX: "fileIndex",
} as const;

/**
 * Service initialization options
 */
export interface ServiceInitOptions {
  configPath?: string;
  organizationSlug?: string; // Organization slug to use for this session
  rules?: string[];
  headless?: boolean;
  skipOnboarding?: boolean; // Skip onboarding check even in TUI mode
  toolPermissionOverrides?: {
    allow?: string[];
    ask?: string[];
    exclude?: string[];
    mode?: PermissionMode;
  };
}

/**
 * Service initialization result
 */
export interface ServiceInitResult {
  wasOnboarded?: boolean;
}
