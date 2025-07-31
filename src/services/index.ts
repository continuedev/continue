import logger from "../util/logger.js";
import { ApiClientService } from "./ApiClientService.js";
import { AuthService } from "./AuthService.js";
import { ConfigService } from "./ConfigService.js";
import { MCPServiceWrapper } from "./MCPServiceWrapper.js";
import { modeService } from "./ModeService.js";
import { ModelService } from "./ModelService.js";
import { serviceContainer } from "./ServiceContainer.js";
import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  SERVICE_NAMES,
  ServiceInitOptions,
} from "./types.js";

// Service instances
const authService = new AuthService();
const configService = new ConfigService();
const modelService = new ModelService();
const apiClientService = new ApiClientService();
const mcpServiceWrapper = new MCPServiceWrapper();

/**
 * Initialize all services and register them with the service container
 */
export async function initializeServices(options: ServiceInitOptions = {}) {
  logger.debug("Initializing service registry");

  // Initialize mode service with tool permission overrides
  if (options.toolPermissionOverrides) {
    const overrides = { ...options.toolPermissionOverrides };
    
    // Convert mode to boolean flags for ModeService
    const initArgs: Parameters<typeof modeService.initialize>[0] = {
      allow: overrides.allow,
      ask: overrides.ask,
      exclude: overrides.exclude
    };
    
    // Only set the boolean flag that corresponds to the mode
    if (overrides.mode === "plan") {
      initArgs.readonly = true;
    } else if (overrides.mode === "auto") {
      initArgs.auto = true;
    }
    // If mode is "normal" or undefined, no flags are set
    
    modeService.initialize(initArgs);
  }
  
  // Always register a factory that returns the current state from modeService
  // This ensures the service container always has the latest mode state
  serviceContainer.register(
    SERVICE_NAMES.TOOL_PERMISSIONS,
    async () => {
      // Always return the current state from the global mode service
      return modeService.getToolPermissionService().getState();
    },
    []
  );

  serviceContainer.register(
    SERVICE_NAMES.AUTH,
    () => authService.initialize(),
    [] // No dependencies
  );

  serviceContainer.register(
    SERVICE_NAMES.API_CLIENT,
    async () => {
      const authState = await serviceContainer.get<AuthServiceState>(
        SERVICE_NAMES.AUTH
      );
      return apiClientService.initialize(authState.authConfig);
    },
    [SERVICE_NAMES.AUTH] // Depends on auth
  );

  serviceContainer.register(
    SERVICE_NAMES.CONFIG,
    async () => {
      const [authState, apiClientState] = await Promise.all([
        serviceContainer.get<AuthServiceState>(SERVICE_NAMES.AUTH),
        serviceContainer.get<ApiClientServiceState>(SERVICE_NAMES.API_CLIENT),
      ]);

      // Ensure organization is selected if authenticated and not headless
      let finalAuthState = authState;
      if (authState.authConfig && !options.headless) {
        finalAuthState = await authService.ensureOrganization(
          options.headless ?? false
        );
        // Update the auth service state in container
        serviceContainer.set(SERVICE_NAMES.AUTH, finalAuthState);
      }

      if (!apiClientState.apiClient) {
        throw new Error("API client not available");
      }

      // Use current config path from ConfigService state if available (for reloads),
      // otherwise use initial options.configPath (for first initialization)
      const currentState = configService.getState();
      let configPath =
        currentState.configPath !== undefined
          ? currentState.configPath
          : options.configPath;

      // If no config path is available, check for saved config URI in auth config
      if (!configPath) {
        const { getConfigUri, uriToPath, uriToSlug } = await import(
          "../auth/workos.js"
        );
        const configUri = getConfigUri(finalAuthState.authConfig);
        if (configUri) {
          const filePath = uriToPath(configUri);
          const slug = uriToSlug(configUri);
          configPath = filePath || slug || undefined;
        }
      }

      return configService.initialize(
        finalAuthState.authConfig,
        configPath,
        finalAuthState.organizationId || null,
        apiClientState.apiClient,
        options.rules
      );
    },
    [SERVICE_NAMES.AUTH, SERVICE_NAMES.API_CLIENT] // Depends on auth and API client
  );

  serviceContainer.register(
    SERVICE_NAMES.MODEL,
    async () => {
      const [configState, authState] = await Promise.all([
        serviceContainer.get<ConfigServiceState>(SERVICE_NAMES.CONFIG),
        serviceContainer.get<AuthServiceState>(SERVICE_NAMES.AUTH),
      ]);

      if (!configState.config) {
        throw new Error("Config not available");
      }

      return modelService.initialize(configState.config, authState.authConfig);
    },
    [SERVICE_NAMES.CONFIG, SERVICE_NAMES.AUTH] // Depends on config and auth
  );

  serviceContainer.register(
    SERVICE_NAMES.MCP,
    async () => {
      const configState = await serviceContainer.get<ConfigServiceState>(
        SERVICE_NAMES.CONFIG
      );

      if (!configState.config) {
        throw new Error("Config not available for MCP service");
      }

      return mcpServiceWrapper.initialize(configState.config);
    },
    [SERVICE_NAMES.CONFIG] // Depends on config
  );

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
  return [
    SERVICE_NAMES.TOOL_PERMISSIONS,
    SERVICE_NAMES.AUTH,
    SERVICE_NAMES.API_CLIENT,
    SERVICE_NAMES.CONFIG,
    SERVICE_NAMES.MODEL,
    SERVICE_NAMES.MCP,
  ].every((name) => serviceContainer.isReady(name));
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
  mcp: mcpServiceWrapper,
  mode: modeService,
} as const;

// Export the service container for advanced usage
export { serviceContainer };

// Export service names and types
export type * from "./types.js";
export { SERVICE_NAMES } from "./types.js";
