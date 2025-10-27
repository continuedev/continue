import {
  AssistantUnrolled,
  decodePackageIdentifier,
  mergeUnrolledAssistants,
  PackageIdentifier,
} from "@continuedev/config-yaml";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";

import { isStringRule } from "src/hubLoader.js";
import { getErrorString } from "src/util/error.js";

import { AuthConfig, loadAuthConfig } from "../auth/workos.js";
import { BaseCommandOptions } from "../commands/BaseCommandOptions.js";
import {
  loadConfiguration,
  unrollPackageIdentifiersAsConfigYaml,
} from "../configLoader.js";
import { logger } from "../util/logger.js";

import { BaseService, ServiceWithDependencies } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { ToolPermissionServiceState } from "./ToolPermissionService.js";
import {
  AgentFileServiceState,
  ApiClientServiceState,
  ConfigServiceState,
  SERVICE_NAMES,
} from "./types.js";

const DEFAULT_MODEL_IDENTIFIER: PackageIdentifier = {
  uriType: "slug",
  fullSlug: {
    ownerSlug: "anthropic",
    packageSlug: "claude-sonnet-4-5",
    versionSlug: "1.0.0",
  },
};

interface ConfigServiceInit {
  authConfig: AuthConfig;
  configPath: string | undefined;
  apiClient: DefaultApiInterface;
  agentFileState: AgentFileServiceState;
  injectedConfigOptions?: BaseCommandOptions;
  isHeadless?: boolean;
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

    const options = injectedConfigOptions || {};

    this.processModels(options.model || [], agentFileState, packageIdentifiers);
    this.processMcpServers(
      options.mcp || [],
      agentFileState,
      packageIdentifiers,
      additional,
    );
    this.processAgentFileRules(agentFileState, packageIdentifiers);
    this.processRulesAndPrompts(
      options.rule || [],
      options.prompt || [],
      packageIdentifiers,
      additional,
    );
    this.processAgentFilePrompt(agentFileState, additional);

    return {
      injected: packageIdentifiers,
      additional,
    };
  }

  private processModels(
    models: string[],
    agentFileState: AgentFileServiceState | undefined,
    packageIdentifiers: PackageIdentifier[],
  ): void {
    const allModels = [...models];
    if (agentFileState?.agentFile?.model) {
      allModels.push(agentFileState.agentFile.model);
    }

    for (const model of allModels) {
      try {
        packageIdentifiers.push(decodePackageIdentifier(model));
      } catch (e) {
        logger.warn(`Failed to add model "${model}": ${getErrorString(e)}`);
      }
    }
  }

  private processMcpServers(
    mcps: string[],
    agentFileState: AgentFileServiceState | undefined,
    packageIdentifiers: PackageIdentifier[],
    additional: AssistantUnrolled,
  ): void {
    const allMcps = [
      ...mcps,
      ...(agentFileState?.parsedTools?.mcpServers || []),
    ];

    for (const mcp of allMcps) {
      try {
        if (this.isUrl(mcp)) {
          additional.mcpServers!.push({
            name: new URL(mcp).hostname,
            url: mcp,
          });
        } else {
          packageIdentifiers.push(decodePackageIdentifier(mcp));
        }
      } catch (e) {
        logger.warn(`Failed to add MCP server "${mcp}": ${getErrorString(e)}`);
      }
    }
  }

  private processAgentFileRules(
    agentFileState: AgentFileServiceState | undefined,
    packageIdentifiers: PackageIdentifier[],
  ): void {
    for (const rule of agentFileState?.parsedRules || []) {
      try {
        packageIdentifiers.push(decodePackageIdentifier(rule));
      } catch (e) {
        logger.warn(
          `Failed to get rule "${rule} (from agent file)": ${getErrorString(e)}`,
        );
      }
    }
  }

  private processRulesAndPrompts(
    rules: string[],
    prompts: string[],
    packageIdentifiers: PackageIdentifier[],
    additional: AssistantUnrolled,
  ): void {
    const allRulesAndPrompts = [...rules, ...prompts];

    for (const item of allRulesAndPrompts) {
      try {
        if (isStringRule(item)) {
          additional.rules!.push(item);
        } else {
          packageIdentifiers.push(decodePackageIdentifier(item));
        }
      } catch (e) {
        logger.warn(
          `Failed to load rule or prompt "${item}": ${getErrorString(e)}`,
        );
      }
    }
  }

  private processAgentFilePrompt(
    agentFileState: AgentFileServiceState | undefined,
    additional: AssistantUnrolled,
  ): void {
    if (agentFileState?.agentFile?.prompt) {
      additional.prompts!.push({
        name: `Agent prompt (${agentFileState.agentFile.name})`,
        prompt: agentFileState.agentFile.prompt,
        description: agentFileState.agentFile.description,
      });
    }
  }

  private isUrl(value: string): boolean {
    return value.startsWith("http://") || value.startsWith("https://");
  }

  async addDefaultChatModelIfNone(
    config: AssistantUnrolled,
    apiClient: DefaultApiInterface,
    authConfig: AuthConfig | undefined,
    isHeadless?: boolean,
  ): Promise<AssistantUnrolled> {
    const hasChatModel = !!config.models?.find(
      (m) => !!m && (!m.roles || m.roles.includes("chat")),
    );
    if (!hasChatModel) {
      try {
        const modelConfig = await unrollPackageIdentifiersAsConfigYaml(
          [DEFAULT_MODEL_IDENTIFIER],
          authConfig?.accessToken ?? null,
          authConfig?.organizationId ?? null,
          apiClient,
        );
        const defaultModel = modelConfig?.models?.[0];
        if (!defaultModel) {
          throw new Error("Loaded default model contained no model block");
        }
        config.models = [...(config.models || []), defaultModel];
      } catch (e) {
        if (isHeadless) {
          throw new Error(
            "No model specified in headless mode (and failed to load default model)",
          );
        } else {
          logger.error(
            "Failed to load default model with no model specified",
            e,
          );
        }
      }
    }
    return config;
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
      init.isHeadless,
    );

    const loadedConfig = result.config;
    const merged = mergeUnrolledAssistants(loadedConfig, additional);

    const withModel = await this.addDefaultChatModelIfNone(
      merged,
      apiClient,
      authConfig,
      init.isHeadless,
    );

    // Config URI persistence is now handled by the streamlined loader
    logger.debug("ConfigService initialized successfully");

    const state = {
      config: withModel,
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

      const toolPermissionsState =
        await serviceContainer.get<ToolPermissionServiceState>(
          SERVICE_NAMES.TOOL_PERMISSIONS,
        );

      const result = await this.loadConfig({
        agentFileState,
        apiClient,
        authConfig,
        configPath: newConfigPath,
        injectedConfigOptions: {},
        isHeadless: toolPermissionsState.isHeadless,
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
