import {
  AssistantUnrolled,
  parseAgentFileTools,
  Rule,
} from "@continuedev/config-yaml";

import { BaseCommandOptions } from "./commands/BaseCommandOptions.js";
import {
  loadPackageFromHub,
  loadPackagesFromHub,
  mcpProcessor,
  modelProcessor,
  processRule,
} from "./hubLoader.js";
import { AgentFileServiceState } from "./services/types.js";
import { logger } from "./util/logger.js";

/**
 * Enhances a configuration by injecting additional components from CLI flags
 */
export class ConfigEnhancer {
  // added this for lint complexity rule
  private async enhanceConfigFromAgentFile(
    config: AssistantUnrolled,
    _options: BaseCommandOptions | undefined,
    agentFileState?: AgentFileServiceState,
  ) {
    const enhancedConfig = { ...config };
    const options = { ..._options };

    if (agentFileState?.agentFile) {
      const { rules, model, tools, prompt } = agentFileState?.agentFile;
      if (rules) {
        options.rule = [
          ...rules
            .split(",")
            .filter(Boolean)
            .map((r) => r.trim()),
          ...(options.rule || []),
        ];
      }

      if (tools) {
        try {
          const parsedTools = parseAgentFileTools(tools);
          if (parsedTools.mcpServers.length > 0) {
            options.mcp = [...parsedTools.mcpServers, ...(options.mcp || [])];
          }
        } catch (e) {
          logger.error("Failed to parse agent file tools", e);
        }
      }

      // --model takes precedence over agent file model
      if (model) {
        try {
          const agentFileModel = await loadPackageFromHub(
            model,
            modelProcessor,
          );
          enhancedConfig.models = [
            agentFileModel,
            ...(enhancedConfig.models ?? []),
          ];
          agentFileState?.agentFileService?.setagentFileModelName(
            agentFileModel.name,
          );
        } catch (e) {
          logger.error("Failed to load agent model", e);
        }
      }

      // Agent file prompt is included as a slash command, initial kickoff is handled elsewhere
      if (prompt) {
        enhancedConfig.prompts = [
          {
            name: `Agent prompt (${agentFileState.agentFile.name})`,
            prompt,
            description: agentFileState.agentFile.description,
          },
          ...(enhancedConfig.prompts ?? []),
        ];
      }
    }
    return { options, enhancedConfig };
  }
  /**
   * Apply all enhancements to a configuration
   */
  async enhanceConfig(
    config: AssistantUnrolled,
    _options?: BaseCommandOptions,
    agentFileState?: AgentFileServiceState,
  ): Promise<AssistantUnrolled> {
    const enhanced = await this.enhanceConfigFromAgentFile(
      config,
      _options,
      agentFileState,
    );
    let { enhancedConfig } = enhanced;
    const { options } = enhanced;

    // Inject resolved items into config
    if (options.rule && options.rule.length > 0) {
      enhancedConfig = await this.injectRules(enhancedConfig, options.rule);
    }

    if (options.mcp && options.mcp.length > 0) {
      enhancedConfig = await this.injectMcps(enhancedConfig, options.mcp);
    }

    if (options.model && options.model.length > 0) {
      enhancedConfig = await this.injectModels(enhancedConfig, options.model);
    }

    if (options.prompt && options.prompt.length > 0) {
      enhancedConfig = await this.injectPrompts(enhancedConfig, options.prompt);
    }

    return enhancedConfig;
  }

  /**
   * Inject rules into the system message
   */
  private async injectRules(
    config: AssistantUnrolled,
    rules: string[],
  ): Promise<AssistantUnrolled> {
    const processedRules: Rule[] = [];

    for (const ruleSpec of rules) {
      try {
        const processedContent = await processRule(ruleSpec);

        // Check if this is a hub slug (contains / but doesn't start with . or /)
        const isHubSlug =
          ruleSpec.includes("/") &&
          !ruleSpec.startsWith(".") &&
          !ruleSpec.startsWith("/");

        if (isHubSlug) {
          // Store as RuleObject with name (slug) and rule (content)
          processedRules.push({
            name: ruleSpec,
            rule: processedContent,
          });
        } else {
          // Store as plain string for file paths or direct content
          processedRules.push(processedContent);
        }
      } catch (error: any) {
        logger.warn(`Failed to process rule "${ruleSpec}": ${error.message}`);
      }
    }

    // Clone the config to avoid mutating the original
    const modifiedConfig = { ...config };

    // Add processed rules to the config's rules array
    if (processedRules.length > 0) {
      // Combine with existing rules if any
      const existingRules = modifiedConfig.rules || [];
      modifiedConfig.rules = [...existingRules, ...processedRules];
    }

    return modifiedConfig;
  }

  /**
   * Inject MCP servers into the configuration
   */
  private async injectMcps(
    config: AssistantUnrolled,
    mcps: string[],
  ): Promise<AssistantUnrolled> {
    const processedMcps: any[] = [];

    // Process each MCP spec - check if it's a URL or hub slug
    for (const mcpSpec of mcps) {
      try {
        // Check if it's a URL (starts with http:// or https://)
        if (mcpSpec.startsWith("http://") || mcpSpec.startsWith("https://")) {
          // Create a streamable-http MCP configuration
          processedMcps.push({
            name: new URL(mcpSpec).hostname,
            type: "streamable-http",
            url: mcpSpec,
          });
        } else {
          // Otherwise, treat it as a hub slug
          const hubMcp = await loadPackageFromHub(mcpSpec, mcpProcessor);
          processedMcps.push(hubMcp);
        }
      } catch (error: any) {
        logger.warn(`Failed to load MCP "${mcpSpec}": ${error.message}`);
      }
    }

    // Clone the config to avoid mutating the original
    const modifiedConfig = { ...config };

    // Prepend processed MCPs to existing mcpServers array for consistency
    const existingMcpServers = modifiedConfig.mcpServers || [];
    modifiedConfig.mcpServers = [...processedMcps, ...existingMcpServers];

    return modifiedConfig;
  }

  /**
   * Inject models into the configuration
   */
  private async injectModels(
    config: AssistantUnrolled,
    models: string[],
  ): Promise<AssistantUnrolled> {
    const processedModels = await loadPackagesFromHub(models, modelProcessor);

    const modifiedConfig = { ...config };

    // Prepend processed models to existing models array so they become the default
    const existingModels = modifiedConfig.models || [];
    modifiedConfig.models = [...processedModels, ...existingModels];

    return modifiedConfig;
  }

  /**
   * Inject prompts into the configuration
   * Note: Prompts are processed at runtime via processAndCombinePrompts(),
   * not injected into the config. This method exists for consistency with
   * other injection methods but doesn't modify the config.
   */
  private async injectPrompts(
    config: AssistantUnrolled,
    prompts: string[],
  ): Promise<AssistantUnrolled> {
    // Prompts are handled at runtime by processAndCombinePrompts in chat.ts
    // They don't need to be injected into the configuration
    logger.debug("Prompts will be processed at runtime", { prompts });
    return config;
  }
}

/**
 * Global config enhancer instance
 */
export const configEnhancer = new ConfigEnhancer();
