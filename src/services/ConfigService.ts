import { AssistantUnrolled } from "@continuedev/config-yaml";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";
import { processRule } from '../args.js';
import { loadConfig } from '../config.js';
import { AuthConfig, updateAssistantSlug } from '../auth/workos.js';
import logger from '../util/logger.js';
import { ConfigServiceState } from './types.js';

/**
 * Service for managing configuration state and operations
 * Handles loading configs from files or assistant slugs
 */
export class ConfigService {
  private currentState: ConfigServiceState = {
    config: null,
    configPath: undefined
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
    logger.debug('Initializing ConfigService', { configPath, organizationId });
    
    try {
      let config = await loadConfig(authConfig, configPath, organizationId, apiClient);
      
      // Inject rules if provided
      if (rules && rules.length > 0) {
        config = await this.injectRulesIntoConfig(config, rules);
      }

      this.currentState = {
        config,
        configPath
      };

      // Save assistant slug to auth config if loading by slug
      if (configPath && !this.isFilePath(configPath)) {
        updateAssistantSlug(configPath);
      }

      logger.debug('ConfigService initialized successfully');
      return this.currentState;
    } catch (error: any) {
      logger.error('Failed to initialize ConfigService:', error);
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
    logger.debug('Switching configuration', { 
      from: this.currentState.configPath,
      to: newConfigPath 
    });

    try {
      let config = await loadConfig(authConfig, newConfigPath, organizationId, apiClient);
      
      // Inject rules if provided
      if (rules && rules.length > 0) {
        config = await this.injectRulesIntoConfig(config, rules);
      }

      this.currentState = {
        config,
        configPath: newConfigPath
      };

      // Save assistant slug to auth config if loading by slug
      if (!this.isFilePath(newConfigPath)) {
        updateAssistantSlug(newConfigPath);
      }

      logger.debug('Configuration switched successfully', { 
        newConfigPath 
      });

      return this.currentState;
    } catch (error: any) {
      logger.error('Failed to switch configuration:', error);
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
      throw new Error('No configuration path available for reload');
    }

    logger.debug('Reloading current configuration');
    
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
      (modifiedConfig as any).systemMessage = `${existingSystemMessage}\n\n${rulesSection}`;
    } else {
      (modifiedConfig as any).systemMessage = rulesSection;
    }

    return modifiedConfig;
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