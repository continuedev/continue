import { AssistantUnrolled } from "@continuedev/config-yaml";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";
import { processRule } from "../args.js";
import {
  AuthConfig,
  loadAuthConfig,
  pathToUri,
  slugToUri,
  updateConfigUri,
} from "../auth/workos.js";
import { loadConfig } from "../config.js";
import logger from "../util/logger.js";
import { serviceContainer } from "./ServiceContainer.js";
import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  SERVICE_NAMES,
} from "./types.js";

/**
 * Service for managing configuration state and operations
 * Handles loading configs from files or assistant slugs
 */
export class ConfigService {
  private currentState: ConfigServiceState = {
    config: null,
    configPath: undefined,
  };

  /**
   * Initialize the config service
   */
  async initialize(
    authConfig: AuthConfig,
    configPath: string | undefined,
    organizationId: string | null,
    apiClient: DefaultApiInterface,
    rules?: string[]
  ): Promise<ConfigServiceState> {
    try {
      let config = await loadConfig(
        authConfig,
        configPath,
        organizationId,
        apiClient
      );

      // Inject rules if provided
      if (rules && rules.length > 0) {
        config = await this.injectRulesIntoConfig(config, rules);
      }

      this.currentState = {
        config,
        configPath,
      };

      // Save config URI to auth config
      if (configPath) {
        const configUri = this.isFilePath(configPath)
          ? pathToUri(configPath)
          : slugToUri(configPath);
        updateConfigUri(configUri);
      } else {
        updateConfigUri(null);
      }

      logger.debug("ConfigService initialized successfully");
      return this.currentState;
    } catch (error: any) {
      logger.error("Failed to initialize ConfigService:", error);
      throw error;
    }
  }

  /**
   * Get current config state
   */
  getState(): ConfigServiceState {
    return { ...this.currentState };
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
      let config = await loadConfig(
        authConfig,
        newConfigPath,
        organizationId,
        apiClient
      );

      // Inject rules if provided
      if (rules && rules.length > 0) {
        config = await this.injectRulesIntoConfig(config, rules);
      }

      this.currentState = {
        config,
        configPath: newConfigPath,
      };

      // Save config URI to auth config
      const configUri = this.isFilePath(newConfigPath)
        ? pathToUri(newConfigPath)
        : slugToUri(newConfigPath);
      updateConfigUri(configUri);

      logger.debug("Configuration switched successfully", {
        newConfigPath,
      });

      return this.currentState;
    } catch (error: any) {
      logger.error("Failed to switch configuration:", error);
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

      // Load the new configuration
      let config = await loadConfig(
        authConfig,
        newConfigPath,
        authState.organizationId || null,
        apiClientState.apiClient
      );

      // Update internal state
      this.currentState = {
        config,
        configPath: newConfigPath,
      };

      // Save config URI to auth config
      if (newConfigPath) {
        const configUri = this.isFilePath(newConfigPath)
          ? pathToUri(newConfigPath)
          : slugToUri(newConfigPath);
        updateConfigUri(configUri);
      } else {
        // Clear config URI when switching to undefined
        updateConfigUri(null);
      }

      // Update the CONFIG service in the container
      serviceContainer.set(SERVICE_NAMES.CONFIG, this.currentState);

      // Manually reload dependent services (MODEL, MCP) to pick up the new config
      await serviceContainer.reload(SERVICE_NAMES.MODEL);
      await serviceContainer.reload(SERVICE_NAMES.MCP);

      logger.debug("Configuration path updated successfully", {
        newConfigPath,
        configName: config.name,
      });
    } catch (error: any) {
      logger.error("Failed to update configuration path:", error);
      throw error;
    }
  }

  /**
   * Check if a config path is a file path vs assistant slug
   */
  private isFilePath(configPath: string): boolean {
    return (
      configPath.startsWith(".") ||
      configPath.startsWith("/") ||
      configPath.startsWith("~")
    );
  }
}
