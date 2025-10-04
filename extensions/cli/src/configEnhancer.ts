import {
  AssistantUnrolled,
  parseWorkflowTools,
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
import { WorkflowServiceState } from "./services/types.js";
import { logger } from "./util/logger.js";

/**
 * Enhances a configuration by injecting additional components from CLI flags
 */
export class ConfigEnhancer {
  // added this for lint complexity rule
  private async enhanceConfigFromWorkflow(
    config: AssistantUnrolled,
    _options: BaseCommandOptions | undefined,
    workflowState?: WorkflowServiceState,
  ) {
    const enhancedConfig = { ...config };
    const options = { ..._options };

    if (workflowState?.workflowFile) {
      const { rules, model, tools, prompt } = workflowState?.workflowFile;
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
          const parsedTools = parseWorkflowTools(tools);
          if (parsedTools.mcpServers.length > 0) {
            options.mcp = [...parsedTools.mcpServers, ...(options.mcp || [])];
          }
        } catch (e) {
          logger.error("Failed to parse workflow tools", e);
        }
      }

      // --model takes precedence over workflow model
      if (model) {
        try {
          const workflowModel = await loadPackageFromHub(model, modelProcessor);
          enhancedConfig.models = [
            workflowModel,
            ...(enhancedConfig.models ?? []),
          ];
          workflowState?.workflowService?.setWorkflowModelName(
            workflowModel.name,
          );
        } catch (e) {
          logger.error("Failed to load workflow model", e);
        }
      }

      // Workflow prompt is included as a slash command, initial kickoff is handled elsewhere
      if (prompt) {
        enhancedConfig.prompts = [
          {
            name: `Workflow prompt (${workflowState.workflowFile.name})`,
            prompt,
            description: workflowState.workflowFile.description,
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
    workflowState?: WorkflowServiceState,
  ): Promise<AssistantUnrolled> {
    const enhanced = await this.enhanceConfigFromWorkflow(
      config,
      _options,
      workflowState,
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
    const processedMcps = await loadPackagesFromHub(mcps, mcpProcessor);

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
