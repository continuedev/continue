import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";
import { AuthConfig } from "../auth/workos.js";
import { MCPService } from "../mcp.js";
import { PermissionMode, ToolPermissions } from "../permissions/types.js";

/**
 * Service lifecycle states
 */
export type ServiceState = 'idle' | 'loading' | 'ready' | 'error';

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

export interface MCPServiceState {
  mcpService: MCPService | null;
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

/**
 * Service names as constants to prevent typos
 */
export const SERVICE_NAMES = {
  AUTH: 'auth',
  CONFIG: 'config', 
  MODEL: 'model',
  MCP: 'mcp',
  API_CLIENT: 'apiClient',
  TOOL_PERMISSIONS: 'toolPermissions'
} as const;

/**
 * Service initialization options
 */
export interface ServiceInitOptions {
  configPath?: string;
  rules?: string[];
  headless?: boolean;
  toolPermissionOverrides?: {
    allow?: string[];
    ask?: string[];
    exclude?: string[];
    mode?: PermissionMode;
  };
}