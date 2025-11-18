/**
 * Workflow Templates Module
 *
 * This module provides the core functionality for workflow templates in Code Mode.
 * It enables 98% token reduction for AI agents via MCP code execution.
 *
 * @packageDocumentation
 */

// Export types
export * from './types';

// Export services
export { TemplateRegistry, getTemplateRegistry } from './TemplateRegistry';
export { TemplateValidator } from './TemplateValidator';
export { TemplateInstantiator } from './TemplateInstantiator';
export { WorkflowScheduler } from './WorkflowScheduler';
export { WebhookHandler } from './WebhookHandler';
export { E2BSandboxManager } from './E2BSandboxManager';

// Export convenience functions
import { TemplateRegistry, getTemplateRegistry } from './TemplateRegistry';
import { TemplateValidator } from './TemplateValidator';
import { TemplateInstantiator } from './TemplateInstantiator';
import { WorkflowScheduler } from './WorkflowScheduler';
import { WebhookHandler } from './WebhookHandler';
import { E2BSandboxManager } from './E2BSandboxManager';
import {
  Template,
  Workflow,
  InstantiationRequest,
} from './types';

/**
 * Initialize workflow templates system
 */
export async function initializeWorkflowSystem(templateDir: string): Promise<{
  registry: TemplateRegistry;
  validator: TemplateValidator;
  instantiator: TemplateInstantiator;
  scheduler: WorkflowScheduler;
  webhookHandler: WebhookHandler;
  sandboxManager: E2BSandboxManager;
}> {
  console.log('[WorkflowSystem] Initializing workflow templates system...');

  // Create services
  const registry = getTemplateRegistry(templateDir);
  const validator = new TemplateValidator();
  const sandboxManager = new E2BSandboxManager();
  const instantiator = new TemplateInstantiator(registry, sandboxManager);
  const scheduler = new WorkflowScheduler(sandboxManager);
  const webhookHandler = new WebhookHandler();

  // Initialize registry
  await registry.initialize();

  // Start scheduler
  scheduler.start();

  console.log('[WorkflowSystem] Workflow templates system initialized successfully');

  return {
    registry,
    validator,
    instantiator,
    scheduler,
    webhookHandler,
    sandboxManager,
  };
}

/**
 * Create a workflow from a template (convenience function)
 */
export async function createWorkflowFromTemplate(
  request: InstantiationRequest
): Promise<Workflow> {
  const templateDir = process.env.TEMPLATE_DIR || './templates';
  const registry = getTemplateRegistry(templateDir);
  const sandboxManager = new E2BSandboxManager();
  const instantiator = new TemplateInstantiator(registry, sandboxManager);

  return await instantiator.instantiate(request);
}

/**
 * List all available templates (convenience function)
 */
export async function listAvailableTemplates() {
  const templateDir = process.env.TEMPLATE_DIR || './templates';
  const registry = getTemplateRegistry(templateDir);

  return await registry.listTemplates();
}

/**
 * Get template by ID (convenience function)
 */
export async function getTemplateById(templateId: string): Promise<Template | null> {
  const templateDir = process.env.TEMPLATE_DIR || './templates';
  const registry = getTemplateRegistry(templateDir);

  return await registry.getTemplate(templateId);
}
