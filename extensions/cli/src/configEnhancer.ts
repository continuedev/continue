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
 * Enhances a configuration by injecting additional components from CLI flags and workflow
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

    // Apply workflow components first (highest priority)
    enhancedConfig = await this.injectWorkflowRules(enhancedConfig);
    enhancedConfig = await this.injectWorkflowMcpServers(enhancedConfig);

    // Apply rules
    if (options.rule && options.rule.length > 0) {
      enhancedConfig = await this.injectRules(enhancedConfig, options.rule);
    }

    // Apply MCPs
    if (options.mcp && options.mcp.length > 0) {
      enhancedConfig = await this.injectMcps(enhancedConfig, options.mcp);
    }

    // Apply models
    if (options.model && options.model.length > 0) {
      enhancedConfig = await this.injectModels(enhancedConfig, options.model);
    }

    // Apply prompts
    if (options.prompt && options.prompt.length > 0) {
      enhancedConfig = await this.injectPrompts(enhancedConfig, options.prompt);
    }

    return enhancedConfig;
  }

  /**
   * Inject workflow rules if a workflow is active
   */
  private async injectWorkflowRules(
    config: AssistantUnrolled,
  ): Promise<AssistantUnrolled> {
    try {
      const workflowState = await serviceContainer.get<WorkflowServiceState>(
        SERVICE_NAMES.WORKFLOW,
      );

      if (!workflowState.isActive || !workflowState.workflowFile?.rules) {
        return config;
      }

      const workflowRules = workflowState.workflowFile.rules;
      const processedContent = await processRule(workflowRules);
      const workflowSlug = workflowState.workflow;

      const workflowRule: Rule = {
        name: `workflow:${workflowSlug}`,
        rule: processedContent,
      };

      const modifiedConfig = { ...config };
      const existingRules = modifiedConfig.rules || [];
      modifiedConfig.rules = [workflowRule, ...existingRules];

      logger.debug(`Injected workflow rules from ${workflowSlug}`);
      return modifiedConfig;
    } catch (error: any) {
      logger.debug(`Workflow service not available: ${error.message}`);
      return config;
    }
  }

  /**
   * Inject workflow MCP servers if a workflow has tools
   */
  private async injectWorkflowMcpServers(
    config: AssistantUnrolled,
  ): Promise<AssistantUnrolled> {
    try {
      const workflowState = await serviceContainer.get<WorkflowServiceState>(
        SERVICE_NAMES.WORKFLOW,
      );

      if (!workflowState.isActive || !workflowState.workflowFile?.tools) {
        return config;
      }

      const parsedTools = parseWorkflowTools(workflowState.workflowFile.tools);
      if (parsedTools.mcpServers.length === 0) {
        return config;
      }

      const processedMcps = await loadPackagesFromHub(
        parsedTools.mcpServers,
        mcpProcessor,
      );
      const modifiedConfig = { ...config };
      const existingMcpServers = (modifiedConfig as any).mcpServers || [];

      // Deduplicate MCP servers by checking if they already exist
      const existingServerNames = new Set(
        existingMcpServers.map((server: any) => server.name || server.slug),
      );

      const newMcpServers = processedMcps.filter((server: any) => {
        const serverName = server.name || server.slug;
        return !existingServerNames.has(serverName);
      });

      if (newMcpServers.length > 0) {
        (modifiedConfig as any).mcpServers = [
          ...newMcpServers,
          ...existingMcpServers,
        ];
        logger.debug(`Injected ${newMcpServers.length} workflow MCP servers`);
      }

      return modifiedConfig;
    } catch (error: any) {
      logger.debug(`Failed to inject workflow MCP servers: ${error.message}`);
      return config;
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
