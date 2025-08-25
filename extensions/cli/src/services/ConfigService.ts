import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";

import { AuthConfig, loadAuthConfig } from "../auth/workos.js";
import { BaseCommandOptions } from "../commands/BaseCommandOptions.js";
import { configEnhancer } from "../configEnhancer.js";
import { logger } from "../util/logger.js";

import { BaseService, ServiceWithDependencies } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import {
  ApiClientServiceState,
  ConfigServiceState,
  SERVICE_NAMES,
} from "./types.js";

/**
 * Service for managing configuration state and operations
 * Handles loading configs from files or assistant slugs
 */
export class ConfigService
  extends BaseService<ConfigServiceState>
  implements ServiceWithDependencies
{
  constructor() {
    super("ConfigService", {
      config: null,
      configPath: undefined,
    });
  }

  /**
   * Declare dependencies on other services
   */
  getDependencies(): string[] {
    return [SERVICE_NAMES.AUTH, SERVICE_NAMES.API_CLIENT];
  }

  /**
   * Initialize the config service
   */
  async doInitialize(
    authConfig: AuthConfig,
    configPath: string | undefined,
    _organizationId: string | null,
    apiClient: DefaultApiInterface,
    injectedConfigOptions?: BaseCommandOptions,
  ): Promise<ConfigServiceState> {
    // Use the new streamlined config loader
    const { loadConfiguration } = await import("../configLoader.js");
    const result = await loadConfiguration(authConfig, configPath, apiClient);

    let config = result.config;

    // Apply injected config if provided
    if (
      injectedConfigOptions &&
      this.hasInjectedConfig(injectedConfigOptions)
    ) {
      config = await configEnhancer.enhanceConfig(
        config,
        injectedConfigOptions,
      );

      logger.debug("Applied injected configuration");
    }

    // Config URI persistence is now handled by the streamlined loader

    logger.debug("ConfigService initialized successfully");

    return {
      config,
      configPath,
    };
  }

  /**
   * Switch to a new configuration
   */
  async switchConfig(
    newConfigPath: string,
    authConfig: AuthConfig,
    _organizationId: string | null,
    apiClient: DefaultApiInterface,
    injectedConfigOptions?: BaseCommandOptions,
  ): Promise<ConfigServiceState> {
    logger.debug("Switching configuration", {
      from: this.currentState.configPath,
      to: newConfigPath,
    });

    try {
      // Use the new streamlined config loader
      const { loadConfiguration } = await import("../configLoader.js");
      const result = await loadConfiguration(
        authConfig,
        newConfigPath,
        apiClient,
      );

      let config = result.config;

      // Apply injected config if provided
      if (
        injectedConfigOptions &&
        this.hasInjectedConfig(injectedConfigOptions)
      ) {
        config = await configEnhancer.enhanceConfig(
          config,
          injectedConfigOptions,
        );

        logger.debug("Applied injected configuration");
      }

      this.setState({
        config,
        configPath: newConfigPath,
      });

      // Config URI persistence is now handled by the streamlined loader

      logger.debug("Configuration switched successfully", {
        newConfigPath,
      });

      return this.getState();
    } catch (error: any) {
      logger.error("Failed to switch configuration:", error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Reload the current configuration
   */
  async reload(
    authConfig: AuthConfig,
    _organizationId: string | null,
    apiClient: DefaultApiInterface,
    injectedConfigOptions?: BaseCommandOptions,
  ): Promise<ConfigServiceState> {
    if (!this.currentState.configPath) {
      throw new Error("No configuration path available for reload");
    }

    logger.debug("Reloading current configuration");

    return this.switchConfig(
      this.currentState.configPath,
      authConfig,
      _organizationId,
      apiClient,
      injectedConfigOptions,
    );
  }

  /**
   * Check if injected config options contain any config to inject
   */
  private hasInjectedConfig(options: BaseCommandOptions): boolean {
    return !!(
      (options.rule && options.rule.length > 0) ||
      (options.mcp && options.mcp.length > 0) ||
      (options.model && options.model.length > 0) ||
      (options.prompt && options.prompt.length > 0)
    );
  }

  /**
   * Update the configuration path and notify the service container
   * This triggers automatic dependent service reloads via the reactive system
   */
  async updateConfigPath(newConfigPath: string | undefined): Promise<void> {
    logger.debug("Updating config path", {
      from: this.currentState.configPath,
      to: newConfigPath,
    });

    try {
      // Get current auth and API client state needed for config loading
      const authConfig = loadAuthConfig();
      const apiClientState = await serviceContainer.get<ApiClientServiceState>(
        SERVICE_NAMES.API_CLIENT,
      );

      if (!apiClientState.apiClient) {
        throw new Error("API client not available");
      }

      // Load the new configuration using streamlined loader
      const { loadConfiguration } = await import("../configLoader.js");
      const result = await loadConfiguration(
        authConfig,
        newConfigPath,
        apiClientState.apiClient,
      );

      // Update internal state
      this.setState({
        config: result.config,
        configPath: newConfigPath,
      });

      // Config URI persistence is now handled by the streamlined loader

      // Update the CONFIG service in the container
      serviceContainer.set(SERVICE_NAMES.CONFIG, this.getState());

      // Manually reload dependent services (MODEL, MCP) to pick up the new config
      await serviceContainer.reload(SERVICE_NAMES.MODEL);
      await serviceContainer.reload(SERVICE_NAMES.MCP);

      logger.debug("Configuration path updated successfully", {
        newConfigPath,
        configName: result.config.name,
      });
    } catch (error: any) {
      logger.error("Failed to update configuration path:", error);
      this.emit("error", error);
      throw error;
    }
  }
}
