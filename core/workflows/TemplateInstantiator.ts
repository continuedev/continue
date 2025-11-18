/**
 * Template Instantiator Service
 *
 * Creates workflow instances from templates with user configuration.
 * Handles template rendering, configuration injection, and workflow creation.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Template,
  Workflow,
  InstantiationRequest,
  ExecutionResult,
  NotificationConfig,
} from './types';
import { TemplateRegistry } from './TemplateRegistry';
import { E2BSandboxManager } from './E2BSandboxManager';

export class TemplateInstantiator {
  private registry: TemplateRegistry;
  private sandboxManager: E2BSandboxManager;

  constructor(registry: TemplateRegistry, sandboxManager: E2BSandboxManager) {
    this.registry = registry;
    this.sandboxManager = sandboxManager;
  }

  /**
   * Create workflow from template
   */
  async instantiate(request: InstantiationRequest): Promise<Workflow> {
    console.log(`[TemplateInstantiator] Instantiating template: ${request.templateId}`);

    // 1. Load template
    const template = await this.registry.getTemplate(request.templateId);
    if (!template) {
      throw new Error(`Template '${request.templateId}' not found`);
    }

    // 2. Validate configuration
    this.validateConfig(template, request.config);

    // 3. Merge with default config
    const mergedConfig = {
      ...template.defaultConfig,
      ...request.config,
    };

    // 4. Create workflow object
    const workflow: Workflow = {
      id: `workflow-${uuidv4()}`,
      name: request.workflowName,
      userId: 'current-user', // TODO: Get from auth context
      organizationId: template.organizationId,
      templateId: template.id,
      templateVersion: template.version,
      repositoryId: request.repositoryId,
      agentId: request.agentId,
      code: template.code, // Code can be customized later
      config: mergedConfig,
      triggerType: request.trigger.type,
      cronExpression: request.trigger.cronExpression,
      webhookSecret: request.trigger.type === 'webhook' ? this.generateWebhookSecret() : undefined,
      enabled: true,
      notificationConfig: request.notificationConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 5. Calculate next execution time for cron
    if (workflow.triggerType === 'cron' && workflow.cronExpression) {
      workflow.nextExecutionAt = this.calculateNextExecution(workflow.cronExpression);
    }

    console.log(`[TemplateInstantiator] Created workflow: ${workflow.id}`);

    return workflow;
  }

  /**
   * Preview rendered template with config
   */
  async preview(templateId: string, config: Record<string, any>): Promise<string> {
    const template = await this.registry.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    this.validateConfig(template, config);

    const mergedConfig = {
      ...template.defaultConfig,
      ...config,
    };

    // Render template with config
    return this.renderTemplate(template.code, mergedConfig);
  }

  /**
   * Test execute template
   */
  async testRun(
    templateId: string,
    config: Record<string, any>,
    repositoryId: string,
    agentId: string
  ): Promise<ExecutionResult> {
    console.log(`[TemplateInstantiator] Test running template: ${templateId}`);

    const template = await this.registry.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    this.validateConfig(template, config);

    const mergedConfig = {
      ...template.defaultConfig,
      ...config,
    };

    // Create temporary execution ID
    const executionId = `test-exec-${uuidv4()}`;

    // Execute in E2B sandbox
    const result = await this.sandboxManager.executeTemplate(
      executionId,
      template.code,
      mergedConfig,
      template.mcpServers,
      repositoryId
    );

    return result;
  }

  /**
   * Validate configuration against template schema
   */
  private validateConfig(template: Template, config: Record<string, any>): void {
    const { configSchema } = template;

    // Check required fields
    for (const requiredField of configSchema.required || []) {
      if (!(requiredField in config) && !(requiredField in template.defaultConfig)) {
        throw new Error(`Required configuration field '${requiredField}' is missing`);
      }
    }

    // Validate each provided config value
    for (const [key, value] of Object.entries(config)) {
      const propertySchema = configSchema.properties[key];

      if (!propertySchema) {
        console.warn(`[TemplateInstantiator] Unknown config field: ${key}`);
        continue;
      }

      // Type validation
      const actualType = this.getTypeOf(value);
      if (actualType !== propertySchema.type) {
        throw new Error(
          `Configuration field '${key}' must be of type ${propertySchema.type}, got ${actualType}`
        );
      }

      // Pattern validation (for strings)
      if (propertySchema.pattern && typeof value === 'string') {
        const regex = new RegExp(propertySchema.pattern);
        if (!regex.test(value)) {
          throw new Error(`Configuration field '${key}' does not match pattern ${propertySchema.pattern}`);
        }
      }

      // Min/max validation (for numbers)
      if (typeof value === 'number') {
        if (propertySchema.minimum !== undefined && value < propertySchema.minimum) {
          throw new Error(
            `Configuration field '${key}' must be at least ${propertySchema.minimum}`
          );
        }
        if (propertySchema.maximum !== undefined && value > propertySchema.maximum) {
          throw new Error(
            `Configuration field '${key}' must be at most ${propertySchema.maximum}`
          );
        }
      }

      // Enum validation
      if (propertySchema.enum && !propertySchema.enum.includes(value)) {
        throw new Error(
          `Configuration field '${key}' must be one of: ${propertySchema.enum.join(', ')}`
        );
      }
    }
  }

  /**
   * Get type of value in schema format
   */
  private getTypeOf(value: any): string {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
  }

  /**
   * Render template code with configuration
   */
  private renderTemplate(code: string, config: Record<string, any>): string {
    // For now, just return the code as-is
    // Configuration is injected at runtime via environment variables
    // In the future, we could do template variable substitution here
    return code;
  }

  /**
   * Generate secure webhook secret
   */
  private generateWebhookSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }

  /**
   * Calculate next execution time from cron expression
   */
  private calculateNextExecution(cronExpression: string): Date {
    // Basic implementation - in production, use a library like 'cron-parser'
    // For now, just return next hour
    const next = new Date();
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
    next.setSeconds(0);
    next.setMilliseconds(0);
    return next;
  }

  /**
   * Update workflow configuration
   */
  async updateWorkflowConfig(
    workflow: Workflow,
    newConfig: Record<string, any>
  ): Promise<Workflow> {
    // Validate new configuration if template is still available
    if (workflow.templateId) {
      const template = await this.registry.getTemplate(workflow.templateId);
      if (template) {
        this.validateConfig(template, newConfig);
      }
    }

    return {
      ...workflow,
      config: newConfig,
      updatedAt: new Date(),
    };
  }

  /**
   * Clone workflow with new name
   */
  async cloneWorkflow(workflow: Workflow, newName: string): Promise<Workflow> {
    return {
      ...workflow,
      id: `workflow-${uuidv4()}`,
      name: newName,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastExecutionAt: undefined,
      nextExecutionAt: workflow.triggerType === 'cron' && workflow.cronExpression
        ? this.calculateNextExecution(workflow.cronExpression)
        : undefined,
    };
  }

  /**
   * Validate cron expression
   */
  validateCronExpression(expression: string): boolean {
    // Basic validation - in production, use a proper cron parser
    const parts = expression.split(' ');
    return parts.length === 5; // Basic cron has 5 parts
  }

  /**
   * Get template usage examples
   */
  async getTemplateExamples(templateId: string): Promise<any[]> {
    const template = await this.registry.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Return example configurations based on use cases
    return template.useCases.map((useCase, index) => ({
      name: useCase,
      config: this.generateExampleConfig(template),
      cronExpression: index === 0 ? '0 9 * * *' : '0 0 * * 0', // Daily or weekly
    }));
  }

  /**
   * Generate example configuration from schema defaults
   */
  private generateExampleConfig(template: Template): Record<string, any> {
    const config: Record<string, any> = {};

    for (const [key, prop] of Object.entries(template.configSchema.properties)) {
      if (prop.default !== undefined) {
        config[key] = prop.default;
      } else if (template.defaultConfig[key] !== undefined) {
        config[key] = template.defaultConfig[key];
      } else {
        // Generate a placeholder value based on type
        switch (prop.type) {
          case 'string':
            config[key] = `example-${key.toLowerCase()}`;
            break;
          case 'number':
            config[key] = prop.minimum || 1;
            break;
          case 'boolean':
            config[key] = false;
            break;
          case 'array':
            config[key] = [];
            break;
        }
      }
    }

    return config;
  }
}
