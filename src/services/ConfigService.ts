import { AssistantUnrolled } from "@continuedev/config-yaml";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";
import { processRule } from "../args.js";
import {
  AuthConfig,
  loadAuthConfig,
} from "../auth/workos.js";
import logger from "../util/logger.js";
import { serviceContainer } from "./ServiceContainer.js";
import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  SERVICE_NAMES,
} from "./types.js";
import { BaseService, ServiceWithDependencies } from "./BaseService.js";

/**
 * Service for managing configuration state and operations
 * Handles loading configs from files or assistant slugs
 */
export class ConfigService extends BaseService<ConfigServiceState> implements ServiceWithDependencies {
  constructor() {
    super('ConfigService', {
      config: null,
      configPath: undefined,
    });
  }

  /**
   * Declare dependencies on other services
   */
  getDependencies(): string[] {
    return ['auth', 'apiClient'];
  }

  /**
   * Initialize the config service
   */
  async doInitialize(
    authConfig: AuthConfig,
    configPath: string | undefined,
    organizationId: string | null,
    apiClient: DefaultApiInterface,
    rules?: string[]
  ): Promise<ConfigServiceState> {
    // Use the new streamlined config loader
    const { loadConfiguration } = await import("../configLoader.js");
    const result = await loadConfiguration(authConfig, configPath, apiClient);
    
    let config = result.config;

    // Inject rules if provided
    if (rules && rules.length > 0) {
      config = await this.injectRulesIntoConfig(config, rules);
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
    organizationId: string | null,
    apiClient: DefaultApiInterface,
    rules?: string[]
  ): Promise<ConfigServiceState> {
    logger.debug("Switching configuration", {
      from: this.currentState.configPath,
      to: newConfigPath,
    });

    try {
      // Use the new streamlined config loader
      const { loadConfiguration } = await import("../configLoader.js");
      const result = await loadConfiguration(authConfig, newConfigPath, apiClient);
      
      let config = result.config;

      // Inject rules if provided
      if (rules && rules.length > 0) {
        config = await this.injectRulesIntoConfig(config, rules);
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
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Reload the current configuration
   */
  async reload(
    authConfig: AuthConfig,
    organizationId: string | null,
    apiClient: DefaultApiInterface,
    rules?: string[]
  ): Promise<ConfigServiceState> {
    if (!this.currentState.configPath) {
      throw new Error("No configuration path available for reload");
    }

    logger.debug("Reloading current configuration");

    return this.switchConfig(
      this.currentState.configPath,
      authConfig,
      organizationId,
      apiClient,
      rules
    );
  }

  /**
   * Process rules and inject them into the assistant config
   */
  private async injectRulesIntoConfig(
    config: AssistantUnrolled,
    rules: string[]
  ): Promise<AssistantUnrolled> {
    if (!rules || rules.length === 0) {
      return config;
    }

    let processedRules: string[] = [];

    for (const ruleSpec of rules) {
      try {
        const processedRule = await processRule(ruleSpec);
        processedRules.push(processedRule);
      } catch (error: any) {
        logger.warn(`Failed to process rule "${ruleSpec}": ${error.message}`);
      }
    }

    if (processedRules.length === 0) {
      return config;
    }

    // Clone the config to avoid mutating the original
    const modifiedConfig = { ...config };

    // Combine processed rules with existing system message if the config has one
    const existingSystemMessage = (modifiedConfig as any).systemMessage || "";
    const rulesSection = processedRules.join("\n\n");

    if (existingSystemMessage) {
      (
        modifiedConfig as any
      ).systemMessage = `${existingSystemMessage}\n\n${rulesSection}`;
    } else {
      (modifiedConfig as any).systemMessage = rulesSection;
    }

    return modifiedConfig;
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
      const authState = await serviceContainer.get<AuthServiceState>(
        SERVICE_NAMES.AUTH
      );
      const apiClientState = await serviceContainer.get<ApiClientServiceState>(
        SERVICE_NAMES.API_CLIENT
      );

      if (!apiClientState.apiClient) {
        throw new Error("API client not available");
      }

      // Load the new configuration using streamlined loader
      const { loadConfiguration } = await import("../configLoader.js");
      const result = await loadConfiguration(
        authConfig, 
        newConfigPath, 
        apiClientState.apiClient
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
      this.emit('error', error);
      throw error;
    }
  }

}