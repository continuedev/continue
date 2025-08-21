import { loadAuthConfig } from "../auth/workos.js";
import { initializeWithOnboarding } from "../onboarding.js";
import { logger } from "../util/logger.js";

import { ApiClientService } from "./ApiClientService.js";
import { AuthService } from "./AuthService.js";
import { ConfigService } from "./ConfigService.js";
import { FileIndexService } from "./FileIndexService.js";
import { MCPService } from "./MCPService.js";
import { ModelService } from "./ModelService.js";
import { modeService } from "./ModeService.js";
import { serviceContainer } from "./ServiceContainer.js";
import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  SERVICE_NAMES,
  ServiceInitOptions,
  ServiceInitResult,
} from "./types.js";

// Service instances
const authService = new AuthService();
const configService = new ConfigService();
const modelService = new ModelService();
const apiClientService = new ApiClientService();
const mcpService = new MCPService();
const fileIndexService = new FileIndexService();

/**
 * Initialize all services and register them with the service container
 * Handles onboarding internally for TUI mode unless skipOnboarding is true
 */
export async function initializeServices(
  options: ServiceInitOptions = {},
): Promise<ServiceInitResult> {
  logger.debug("Initializing service registry");

  let wasOnboarded = false;

  // Handle onboarding for TUI mode (headless: false) unless explicitly skipped
  if (!options.headless && !options.skipOnboarding) {
    const authConfig = loadAuthConfig();
    const onboardingResult = await initializeWithOnboarding(
      authConfig,
      options.configPath,
      options.rules,
    );
    wasOnboarded = onboardingResult.wasOnboarded;
  }

  // Handle ANTHROPIC_API_KEY in headless mode when no config path is provided
  if (
    options.headless &&
    !options.configPath &&
    process.env.ANTHROPIC_API_KEY
  ) {
    const { createOrUpdateConfig } = await import("../onboarding.js");
    const { env } = await import("../env.js");
    const path = await import("path");

    const CONFIG_PATH = path.join(env.continueHome, "config.yaml");
    await createOrUpdateConfig(process.env.ANTHROPIC_API_KEY);

    // Update options to use the created config
    options.configPath = CONFIG_PATH;
  }

  // Initialize mode service with tool permission overrides
  if (options.toolPermissionOverrides) {
    const overrides = { ...options.toolPermissionOverrides };

    // Convert mode to boolean flags for ModeService
    const initArgs: Parameters<typeof modeService.initialize>[0] = {
      allow: overrides.allow,
      ask: overrides.ask,
      exclude: overrides.exclude,
      isHeadless: options.headless,
    };

    // Only set the boolean flag that corresponds to the mode
    if (overrides.mode === "plan") {
      initArgs.readonly = true;
    } else if (overrides.mode === "auto") {
      initArgs.auto = true;
    }
    // If mode is "normal" or undefined, no flags are set

    await modeService.initialize(initArgs);
  } else {
    // Even if no overrides, we need to initialize with defaults
    await modeService.initialize({
      isHeadless: options.headless,
    });
  }

  // Register the TOOL_PERMISSIONS service with immediate value
  // Since ToolPermissionService is already initialized synchronously in ModeService,
  // we can register it as a ready value instead of a factory
  const toolPermissionState = modeService.getToolPermissionService().getState();
  logger.debug("Registering TOOL_PERMISSIONS with state:", {
    currentMode: toolPermissionState.currentMode,
    isHeadless: toolPermissionState.isHeadless,
    policyCount: toolPermissionState.permissions.policies.length,
  });
  serviceContainer.registerValue(
    SERVICE_NAMES.TOOL_PERMISSIONS,
    toolPermissionState,
  );

  serviceContainer.register(
    SERVICE_NAMES.AUTH,
    () => authService.initialize(),
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
    SERVICE_NAMES.CONFIG,
    async () => {
      const [authState, apiClientState] = await Promise.all([
        serviceContainer.get<AuthServiceState>(SERVICE_NAMES.AUTH),
        serviceContainer.get<ApiClientServiceState>(SERVICE_NAMES.API_CLIENT),
      ]);

      // Ensure organization is selected if authenticated
      let finalAuthState = authState;
      if (authState.authConfig) {
        finalAuthState = await authService.ensureOrganization(
          options.headless ?? false,
          options.organizationSlug,
        );
        // Update the auth service state in container
        serviceContainer.set(SERVICE_NAMES.AUTH, finalAuthState);
      }

      if (!apiClientState.apiClient) {
        throw new Error("API client not available");
      }

      // Use current config path from ConfigService state if available (for reloads),
      // otherwise use initial options.configPath (for first initialization)
      // IMPORTANT: Always prefer explicit --config flag over saved state
      const currentState = configService.getState();
      let configPath =
        options.configPath ||
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

      return configService.initialize(
        finalAuthState.authConfig,
        configPath,
        finalAuthState.organizationId || null,
        apiClientState.apiClient,
        options.rules,
      );
    },
    [SERVICE_NAMES.AUTH, SERVICE_NAMES.API_CLIENT], // Depends on auth and API client
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
    [SERVICE_NAMES.CONFIG, SERVICE_NAMES.AUTH], // Depends on config and auth
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
      return mcpService.initialize(configState.config, options.headless);
    },
    [SERVICE_NAMES.CONFIG], // Depends on config
  );

  serviceContainer.register(
    SERVICE_NAMES.FILE_INDEX,
    () => fileIndexService.initialize(),
    [],
  );

  // Eagerly initialize all services to ensure they're ready when needed
  // This avoids race conditions and "service not ready" errors
  await serviceContainer.initializeAll();

  logger.debug("Service registry initialized");

  return { wasOnboarded };
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
    SERVICE_NAMES.FILE_INDEX,
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
  mcp: mcpService,
  fileIndex: fileIndexService,
  mode: modeService,
} as const;

// Export the service container for advanced usage
export { serviceContainer };

// Export service names and types
export type * from "./types.js";
export { SERVICE_NAMES } from "./types.js";
