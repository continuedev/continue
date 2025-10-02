import {
  AssistantUnrolled,
  parseWorkflowTools,
  Rule,
} from "@continuedev/config-yaml";

import { BaseCommandOptions } from "./commands/BaseCommandOptions.js";
import {
  loadPackagesFromHub,
  mcpProcessor,
  modelProcessor,
  processRule,
} from "./hubLoader.js";
import { serviceContainer } from "./services/ServiceContainer.js";
import { SERVICE_NAMES, WorkflowServiceState } from "./services/types.js";
import { logger } from "./util/logger.js";

/**
 * Enhances a configuration by injecting additional components from CLI flags
 */
export class ConfigEnhancer {
  /**
   * Apply all enhancements to a configuration
   */
  async enhanceConfig(
    config: AssistantUnrolled,
    _options: BaseCommandOptions,
  ): Promise<AssistantUnrolled> {
    let enhancedConfig = { ...config };

    // Add workflow rules/mcp servers if present
    let options = { ..._options };
    const workflowState = await serviceContainer.get<WorkflowServiceState>(
      SERVICE_NAMES.WORKFLOW,
    );

    if (workflowState.workflowFile) {
      if (workflowState.workflowFile.rules) {
        options.rule = [
          workflowState.workflowFile.rules,
          ...(options.rule || []),
        ];
      }

      if (workflowState.workflowFile.tools) {
        const parsedTools = parseWorkflowTools(
          workflowState.workflowFile.tools,
        );
        if (parsedTools.mcpServers.length > 0) {
          options.mcp = [...parsedTools.mcpServers, ...(options.mcp || [])];
        }
      }

      // Add workflow model if present (lower priority than --model flag)
      if (workflowState.workflowFile.model && !options.model?.length) {
        options.model = [workflowState.workflowFile.model];
        logger.debug(
          `Added workflow model: ${workflowState.workflowFile.model}`,
        );
      }

      // Add workflow prompt as prefix
      if (workflowState.workflowFile.prompt) {
        options.prompt = [
          workflowState.workflowFile.prompt,
          ...(options.prompt || []),
        ];
        logger.debug(
          `Added workflow prompt as prefix: ${workflowState.workflowFile.prompt.substring(0, 100)}...`,
        );
      }
    }

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
    const existingMcpServers = (modifiedConfig as any).mcpServers || [];
    (modifiedConfig as any).mcpServers = [
      ...processedMcps,
      ...existingMcpServers,
    ];

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

    // Clone the config to avoid mutating the original
    const modifiedConfig = { ...config };

    // Prepend processed models to existing models array so they become the default
    const existingModels = (modifiedConfig as any).models || [];
    (modifiedConfig as any).models = [...processedModels, ...existingModels];

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
