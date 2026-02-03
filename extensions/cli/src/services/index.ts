import { loadAuthConfig } from "../auth/workos.js";
import { initializeWithOnboarding } from "../onboarding.js";
import {
  setBetaSubagentToolEnabled,
  setBetaUploadArtifactToolEnabled,
} from "../tools/toolsConfig.js";
import { logger } from "../util/logger.js";

import { AgentFileService } from "./AgentFileService.js";
import { ApiClientService } from "./ApiClientService.js";
import { ArtifactUploadService } from "./ArtifactUploadService.js";
import { AuthService } from "./AuthService.js";
import { ChatHistoryService } from "./ChatHistoryService.js";
import { ConfigService } from "./ConfigService.js";
import { FileIndexService } from "./FileIndexService.js";
import { GitAiIntegrationService } from "./GitAiIntegrationService.js";
import { MCPService } from "./MCPService.js";
import { ModelService } from "./ModelService.js";
import { ResourceMonitoringService } from "./ResourceMonitoringService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { StorageSyncService } from "./StorageSyncService.js";
import { SystemMessageService } from "./SystemMessageService.js";
import {
  InitializeToolServiceOverrides,
  ToolPermissionService,
} from "./ToolPermissionService.js";
import {
  AgentFileServiceState,
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  MCPServiceState,
  SERVICE_NAMES,
  ServiceInitOptions,
} from "./types.js";
import { UpdateService } from "./UpdateService.js";

// Service instances
const authService = new AuthService();
const configService = new ConfigService();
const modelService = new ModelService();
const apiClientService = new ApiClientService();
const mcpService = new MCPService();
const fileIndexService = new FileIndexService();
const resourceMonitoringService = new ResourceMonitoringService();
const chatHistoryService = new ChatHistoryService();
const updateService = new UpdateService();
const storageSyncService = new StorageSyncService();
const agentFileService = new AgentFileService();
const toolPermissionService = new ToolPermissionService();
const systemMessageService = new SystemMessageService();
const artifactUploadService = new ArtifactUploadService();
const gitAiIntegrationService = new GitAiIntegrationService();

/**
 * Initialize all services and register them with the service container
 * Handles onboarding internally for TUI mode unless skipOnboarding is true
 */
export async function initializeServices(initOptions: ServiceInitOptions = {}) {
  logger.debug("Initializing service registry");

  const commandOptions = initOptions.options || {};

  // Configure beta tools based on command options
  if (commandOptions.betaUploadArtifactTool) {
    setBetaUploadArtifactToolEnabled(true);
  }
  if (commandOptions.betaSubagentTool) {
    setBetaSubagentToolEnabled(true);
  }
  // Handle onboarding for TUI mode (headless: false) unless explicitly skipped
  if (!initOptions.headless && !initOptions.skipOnboarding) {
    const authConfig = loadAuthConfig();
    await initializeWithOnboarding(authConfig, commandOptions.config);
  }

  // Handle ANTHROPIC_API_KEY in headless mode when no config path is provided
  if (
    initOptions.headless &&
    !commandOptions.config &&
    process.env.ANTHROPIC_API_KEY
  ) {
    const { createOrUpdateConfig } = await import("../onboarding.js");
    const { env } = await import("../env.js");
    const path = await import("path");

    const CONFIG_PATH = path.join(env.continueHome, "config.yaml");
    await createOrUpdateConfig(process.env.ANTHROPIC_API_KEY);

    // Update options to use the created config
    commandOptions.config = CONFIG_PATH;
  }

  serviceContainer.register(
    SERVICE_NAMES.AUTH,
    async () => {
      return await authService.initialize();
    },
    [], // No dependencies
  );

  serviceContainer.register(
    SERVICE_NAMES.API_CLIENT,
    async () => {
      const authState = await serviceContainer.get<AuthServiceState>(
        SERVICE_NAMES.AUTH,
      );
      return apiClientService.initialize(authState.authConfig);
    },
    [SERVICE_NAMES.AUTH], // Depends on auth
  );

  serviceContainer.register(
    SERVICE_NAMES.AGENT_FILE,
    async () => {
      const [authState, apiClientState] = await Promise.all([
        serviceContainer.get<AuthServiceState>(SERVICE_NAMES.AUTH),
        serviceContainer.get<ApiClientServiceState>(SERVICE_NAMES.API_CLIENT),
      ]);

      return await agentFileService.initialize(
        commandOptions.agent,
        authState,
        apiClientState,
      );
    },
    [SERVICE_NAMES.AUTH, SERVICE_NAMES.API_CLIENT],
  );

  serviceContainer.register(
    SERVICE_NAMES.TOOL_PERMISSIONS,
    async () => {
      const [mcpState, agentFileState] = await Promise.all([
        serviceContainer.get<MCPServiceState>(SERVICE_NAMES.MCP),
        serviceContainer.get<AgentFileServiceState>(SERVICE_NAMES.AGENT_FILE),
      ]);

      // Initialize mode service with tool permission overrides
      if (initOptions.toolPermissionOverrides) {
        const overrides = { ...initOptions.toolPermissionOverrides };

        // Convert mode to boolean flags for ModeService
        const initArgs: InitializeToolServiceOverrides = {
          allow: overrides.allow,
          ask: overrides.ask,
          exclude: overrides.exclude,
          isHeadless: initOptions.headless,
        };
        // Only set the boolean flag that corresponds to the mode
        if (overrides.mode) {
          initArgs.mode = overrides.mode;
        }
        // If mode is "normal" or undefined, no flags are set
        return await toolPermissionService.initialize(
          initArgs,
          agentFileState,
          mcpState,
        );
      } else {
        // Even if no overrides, we need to initialize with defaults
        return await toolPermissionService.initialize(
          {
            isHeadless: initOptions.headless,
          },
          agentFileState,
          mcpState,
        );
      }
    },
    [SERVICE_NAMES.AGENT_FILE, SERVICE_NAMES.MCP],
  );

  // Initialize SystemMessageService with command options
  serviceContainer.register(
    SERVICE_NAMES.SYSTEM_MESSAGE,
    () =>
      systemMessageService.initialize({
        additionalRules: commandOptions.rule,
        format: (commandOptions as any).format, // format option from CLI
        headless: initOptions.headless,
      }),
    [SERVICE_NAMES.TOOL_PERMISSIONS],
  );

  serviceContainer.register(
    SERVICE_NAMES.UPDATE,
    () => updateService.initialize(),
    [], // No dependencies
  );

  serviceContainer.register(
    SERVICE_NAMES.CONFIG,
    async () => {
      const [authState, apiClientState, agentFileState] = await Promise.all([
        serviceContainer.get<AuthServiceState>(SERVICE_NAMES.AUTH),
        serviceContainer.get<ApiClientServiceState>(SERVICE_NAMES.API_CLIENT),
        serviceContainer.get<AgentFileServiceState>(SERVICE_NAMES.AGENT_FILE),
      ]);

      // Ensure organization is selected if authenticated
      let finalAuthState = authState;
      if (authState.authConfig) {
        finalAuthState = await authService.ensureOrganization(
          initOptions.headless ?? false,
          commandOptions.org,
        );
        // Update the auth service state in container
        serviceContainer.set(SERVICE_NAMES.AUTH, finalAuthState);
      }

      if (!apiClientState.apiClient) {
        throw new Error("API client not available");
      }

      // Use current config path from ConfigService state if available (for reloads),
      // otherwise use initial options.config (for first initialization)
      // IMPORTANT: Always prefer explicit --config flag over saved state
      const currentState = configService.getState();
      let configPath =
        commandOptions.config ||
        (currentState.configPath === undefined
          ? undefined
          : currentState.configPath);

      // If no config path is available, check for saved config URI in auth config
      if (!configPath) {
        const { getConfigUri } = await import("../auth/workos.js");
        const { uriToPath, uriToSlug } = await import("../auth/uriUtils.js");
        const configUri = getConfigUri(finalAuthState.authConfig);
        if (configUri) {
          const filePath = uriToPath(configUri);
          const slug = uriToSlug(configUri);
          configPath = filePath || slug || undefined;
        }
      }

      return await configService.initialize({
        authConfig: finalAuthState.authConfig,
        configPath,
        // organizationId: finalAuthState.organizationId || null,
        apiClient: apiClientState.apiClient,
        agentFileState,
        injectedConfigOptions: commandOptions,
        isHeadless: initOptions.headless,
      });
    },
    [SERVICE_NAMES.AUTH, SERVICE_NAMES.API_CLIENT, SERVICE_NAMES.AGENT_FILE], // Dependencies
  );

  serviceContainer.register(
    SERVICE_NAMES.MODEL,
    async () => {
      const [configState, authState, agentFileState] = await Promise.all([
        serviceContainer.get<ConfigServiceState>(SERVICE_NAMES.CONFIG),
        serviceContainer.get<AuthServiceState>(SERVICE_NAMES.AUTH),
        serviceContainer.get<AgentFileServiceState>(SERVICE_NAMES.AGENT_FILE),
      ]);

      if (!configState.config) {
        throw new Error("Config not available");
      }

      return modelService.initialize(
        configState.config,
        authState.authConfig,
        agentFileState,
      );
    },
    [SERVICE_NAMES.CONFIG, SERVICE_NAMES.AUTH, SERVICE_NAMES.AGENT_FILE], // Depends on config, auth, and agentFile
  );

  serviceContainer.register(
    SERVICE_NAMES.MCP,
    async () => {
      const configState = await serviceContainer.get<ConfigServiceState>(
        SERVICE_NAMES.CONFIG,
      );

      if (!configState.config) {
        throw new Error("Config not available for MCP service");
      }
      return mcpService.initialize(
        configState.config,
        !!initOptions.options?.agent,
        initOptions.headless,
      );
    },
    [SERVICE_NAMES.CONFIG], // Depends on config
  );

  serviceContainer.register(
    SERVICE_NAMES.FILE_INDEX,
    () => fileIndexService.initialize(),
    [],
  );

  serviceContainer.register(
    SERVICE_NAMES.RESOURCE_MONITORING,
    () => resourceMonitoringService.initialize(),
    [],
  );

  serviceContainer.register(
    SERVICE_NAMES.STORAGE_SYNC,
    () => storageSyncService.initialize(),
    [],
  );

  serviceContainer.register(
    SERVICE_NAMES.ARTIFACT_UPLOAD,
    () => artifactUploadService.initialize(),
    [],
  );

  serviceContainer.register(
    SERVICE_NAMES.CHAT_HISTORY,
    () => chatHistoryService.initialize(undefined, initOptions.headless),
    [], // No dependencies for now, but could depend on SESSION in future
  );

  serviceContainer.register(
    SERVICE_NAMES.GIT_AI_INTEGRATION,
    () => gitAiIntegrationService.initialize(),
    [], // No dependencies
  );

  // Eagerly initialize all services to ensure they're ready when needed
  // This avoids race conditions and "service not ready" errors
  await serviceContainer.initializeAll();

  logger.debug("Service registry initialized");
}

/**
 * Get a service from the container (async)
 */
export function getService<T>(serviceName: string): Promise<T> {
  return serviceContainer.get<T>(serviceName);
}

/**
 * Get service state synchronously
 */
export function getServiceSync<T>(serviceName: string) {
  return serviceContainer.getSync<T>(serviceName);
}

/**
 * Reload a specific service
 */
export function reloadService(serviceName: string) {
  return serviceContainer.reload(serviceName);
}

/**
 * Check if all core services are ready
 */
export function areServicesReady(): boolean {
  return Object.values(SERVICE_NAMES).every((name) =>
    serviceContainer.isReady(name),
  );
}

/**
 * Get service states for debugging
 */
export function getServiceStates() {
  return serviceContainer.getServiceStates();
}

/**
 * Direct access to service instances for complex operations
 */
export const services = {
  auth: authService,
  config: configService,
  model: modelService,
  apiClient: apiClientService,
  mcp: mcpService,
  fileIndex: fileIndexService,
  resourceMonitoring: resourceMonitoringService,
  systemMessage: systemMessageService,
  chatHistory: chatHistoryService,
  updateService: updateService,
  storageSync: storageSyncService,
  agentFile: agentFileService,
  toolPermissions: toolPermissionService,
  artifactUpload: artifactUploadService,
  gitAiIntegration: gitAiIntegrationService,
} as const;

export type ServicesType = typeof services;

// Export the service container for advanced usage
export { serviceContainer };

// Export service names and types
export type * from "./types.js";
export { SERVICE_NAMES } from "./types.js";
