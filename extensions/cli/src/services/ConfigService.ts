import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";

import { AuthConfig, loadAuthConfig } from "../auth/workos.js";
import { BaseCommandOptions } from "../commands/BaseCommandOptions.js";
import { loadConfiguration } from "../configLoader.js";
import { logger } from "../util/logger.js";

import {
  AssistantUnrolled,
  decodePackageIdentifier,
  mergeUnrolledAssistants,
  PackageIdentifier,
} from "@continuedev/config-yaml";
import { isStringRule } from "src/hubLoader.js";
import { getErrorString } from "src/util/error.js";
import { BaseService, ServiceWithDependencies } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import {
  AgentFileServiceState,
  ApiClientServiceState,
  ConfigServiceState,
  SERVICE_NAMES,
} from "./types.js";

interface ConfigServiceInit {
  authConfig: AuthConfig;
  configPath: string | undefined;
  apiClient: DefaultApiInterface;
  agentFileState: AgentFileServiceState;
  injectedConfigOptions?: BaseCommandOptions;
}
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
    return [
      SERVICE_NAMES.AUTH,
      SERVICE_NAMES.API_CLIENT,
      SERVICE_NAMES.AGENT_FILE,
    ];
  }

  getAdditionalBlocksFromOptions(
    injectedConfigOptions: BaseCommandOptions | undefined,
    agentFileState: AgentFileServiceState | undefined,
  ): {
    injected: PackageIdentifier[];
    additional: AssistantUnrolled;
  } {
    const packageIdentifiers: PackageIdentifier[] = [];
    const additional: AssistantUnrolled = {
      name: "hidden",
      version: "1.0.0",
      rules: [],
      mcpServers: [],
      prompts: [],
    };

    const {
      model = [],
      mcp = [],
      rule = [],
      prompt = [],
    } = injectedConfigOptions || {};

    // Models: all models will be package identifiers
    if (agentFileState?.agentFile?.model) {
      model.push(agentFileState.agentFile.model);
    }
    for (const _model of model) {
      try {
        packageIdentifiers.push(decodePackageIdentifier(_model));
      } catch (e) {
        logger.warn(`Failed to add modl "${_model}": ${getErrorString(e)}`);
      }
    }

    // MCPs can be package identifiers or URLs
    mcp.push(...(agentFileState?.parsedTools?.mcpServers || []));
    for (const _mcp of mcp) {
      try {
        if (_mcp.startsWith("http://") || _mcp.startsWith("https://")) {
          additional.mcpServers!.push({
            name: new URL(_mcp).hostname,
            url: _mcp,
            // type: "streamable-http", // no need to exclude sse yet
          });
        } else {
          packageIdentifiers.push(decodePackageIdentifier(_mcp));
        }
      } catch (e) {
        logger.warn(`Failed to add MCP server "${_mcp}": ${getErrorString(e)}`);
      }
    }

    // agent file rules can only be package identifiers
    for (const r of agentFileState?.parsedRules || []) {
      try {
        packageIdentifiers.push(decodePackageIdentifier(r));
      } catch (e) {
        logger.warn(
          `Failed to get rule "${r} (from agent file)": ${getErrorString(e)}`,
        );
      }
    }

    // Rule and prompt flags can be either package identifiers or strings
    for (const _rule of [...rule, ...prompt]) {
      try {
        if (isStringRule(_rule)) {
          additional.rules!.push(_rule);
        } else {
          packageIdentifiers.push(decodePackageIdentifier(_rule));
        }
      } catch (e) {
        logger.warn(
          `Failed to load rule or prompt "${_rule}": ${getErrorString(e)}`,
        );
      }
    }

    // Agent file prompt can only be a string
    if (agentFileState?.agentFile?.prompt) {
      additional.prompts!.push({
        name: `Agent prompt (${agentFileState.agentFile.name})`,
        prompt: agentFileState.agentFile.prompt,
        description: agentFileState.agentFile.description,
      });
    }

    // Todo ensure --model models take priority over config models
    return {
      injected: packageIdentifiers,
      additional,
    };
  }

  private async loadConfig(
    init: ConfigServiceInit,
  ): Promise<ConfigServiceState> {
    const {
      authConfig,
      configPath,
      apiClient,
      injectedConfigOptions,
      agentFileState,
    } = init;
    const { injected, additional } = this.getAdditionalBlocksFromOptions(
      injectedConfigOptions,
      agentFileState,
    );

    const result = await loadConfiguration(
      authConfig,
      configPath,
      apiClient,
      injected,
    );

    const loadedConfig = result.config;
    const merged = mergeUnrolledAssistants(loadedConfig, additional);

    // Config URI persistence is now handled by the streamlined loader
    logger.debug("ConfigService initialized successfully");

    const state = {
      config: merged,
      configPath,
    };
    this.setState(state);

    return state;
  }

  /**
   * Initialize the config service
   */
  async doInitialize(init: ConfigServiceInit): Promise<ConfigServiceState> {
    const result = await this.loadConfig(init);

    // Config URI persistence is now handled by the streamlined loader
    logger.debug("ConfigService initialized successfully");

    return result;
  }

  /**
   * Switch to a new configuration
   */
  async switchConfig(init: ConfigServiceInit): Promise<ConfigServiceState> {
    logger.debug("Switching configuration", {
      from: this.currentState.configPath,
      to: init.configPath,
    });

    try {
      const state = await this.loadConfig(init);
      logger.debug("Configuration switched successfully", {
        newConfigPath: init.configPath,
      });

      return state;
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
    init: Omit<ConfigServiceInit, "configPath">,
  ): Promise<ConfigServiceState> {
    if (!this.currentState.configPath) {
      throw new Error("No configuration path available for reload");
    }

    logger.debug("Reloading current configuration");

    return this.switchConfig({
      ...init,
      configPath: this.currentState.configPath,
    });
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
      const { apiClient } = await serviceContainer.get<ApiClientServiceState>(
        SERVICE_NAMES.API_CLIENT,
      );

      if (!apiClient) {
        throw new Error("API client not available");
      }

      const agentFileState = await serviceContainer.get<AgentFileServiceState>(
        SERVICE_NAMES.AGENT_FILE,
      );

      const result = await this.loadConfig({
        agentFileState,
        apiClient,
        authConfig,
        configPath: newConfigPath,
        injectedConfigOptions: {},
      });

      // Manually reload dependent services (MODEL, MCP) to pick up the new config
      await serviceContainer.reload(SERVICE_NAMES.MODEL);
      await serviceContainer.reload(SERVICE_NAMES.MCP);

      logger.debug("Configuration path updated successfully", {
        newConfigPath,
        configName: result.config?.name,
      });
    } catch (error: any) {
      logger.error("Failed to update configuration path:", error);
      this.emit("error", error);
      throw error;
    }
  }

  setState(newState: Partial<ConfigServiceState>): void {
    super.setState(newState);
    serviceContainer.set(SERVICE_NAMES.CONFIG, this.currentState);
  }
}
