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
    options: BaseCommandOptions,
  ): Promise<AssistantUnrolled> {
    let enhancedConfig = { ...config };
    const workflowOptions = await this.addWorkflowOptions(options);

    // Apply rules
    if (workflowOptions.rule && workflowOptions.rule.length > 0) {
      enhancedConfig = await this.injectRules(
        enhancedConfig,
        workflowOptions.rule,
      );
    }

    // Apply MCPs
    if (workflowOptions.mcp && workflowOptions.mcp.length > 0) {
      enhancedConfig = await this.injectMcps(
        enhancedConfig,
        workflowOptions.mcp,
      );
    }

    // Apply models
    if (workflowOptions.model && workflowOptions.model.length > 0) {
      enhancedConfig = await this.injectModels(
        enhancedConfig,
        workflowOptions.model,
      );
    }

    // Apply prompts
    if (workflowOptions.prompt && workflowOptions.prompt.length > 0) {
      enhancedConfig = await this.injectPrompts(
        enhancedConfig,
        workflowOptions.prompt,
      );
    }

    return enhancedConfig;
  }

  /**
   * Add workflow rules and MCPs to options if workflow is active
   */
  private async addWorkflowOptions(
    options: BaseCommandOptions,
  ): Promise<BaseCommandOptions> {
    try {
      const workflowState = await serviceContainer.get<WorkflowServiceState>(
        SERVICE_NAMES.WORKFLOW,
      );

      if (!workflowState.workflowFile) {
        return options;
      }

      const enhancedOptions = { ...options };

      // Add workflow rules if present
      if (workflowState.workflowFile.rules) {
        const existingRules = enhancedOptions.rule || [];
        enhancedOptions.rule = [
          workflowState.workflowFile.rules,
          ...existingRules,
        ];
        logger.debug(`Added workflow rules from ${workflowState.workflow}`);
      }

      // Add workflow MCP servers if present
      if (workflowState.workflowFile.tools) {
        const parsedTools = parseWorkflowTools(
          workflowState.workflowFile.tools,
        );
        if (parsedTools.mcpServers.length > 0) {
          const existingMcps = enhancedOptions.mcp || [];
          enhancedOptions.mcp = [...parsedTools.mcpServers, ...existingMcps];
          logger.debug(
            `Added ${parsedTools.mcpServers.length} workflow MCP servers`,
          );
        }
      }

      return enhancedOptions;
    } catch (error: any) {
      logger.debug(`Workflow service not available: ${error.message}`);
      return options;
    }
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
   */
  private async injectPrompts(
    config: AssistantUnrolled,
    prompts: string[],
  ): Promise<AssistantUnrolled> {
    // For prompts, we'll need a different approach since they become slash commands
    // This is a placeholder implementation
    logger.debug("Prompt injection not yet implemented", { prompts });
    return config;
  }
}

/**
 * Global config enhancer instance
 */
export const configEnhancer = new ConfigEnhancer();
