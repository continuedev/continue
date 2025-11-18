/**
 * Integration tests for Workflow Templates
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  initializeWorkflowSystem,
  createWorkflowFromTemplate,
  listAvailableTemplates,
  getTemplateById,
} from '../index';
import path from 'path';

describe('Workflow Templates Integration', () => {
  const templateDir = path.join(__dirname, '../../../templates');
  let system: any;

  beforeAll(async () => {
    // Initialize the workflow system
    system = await initializeWorkflowSystem(templateDir);
  });

  afterAll(() => {
    // Stop the scheduler
    system.scheduler.stop();
  });

  describe('Template Registry', () => {
    it('should list available templates', async () => {
      const result = await listAvailableTemplates();

      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should get template by ID', async () => {
      const template = await getTemplateById('github-stale-issues');

      if (template) {
        expect(template.id).toBe('github-stale-issues');
        expect(template.name).toBe('Stale Issue Manager');
        expect(template.code).toBeDefined();
        expect(template.mcpServers).toContain('github');
      }
    });

    it('should filter templates by category', async () => {
      const result = await system.registry.listTemplates(
        { category: 'github-automation' },
        50,
        0
      );

      expect(result.items).toBeDefined();
      result.items.forEach((template: any) => {
        expect(template.category).toBe('github-automation');
      });
    });

    it('should search templates by keyword', async () => {
      const results = await system.registry.searchTemplates('github');

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Template Validator', () => {
    it('should validate a correct template', async () => {
      const template = await getTemplateById('github-stale-issues');

      if (template) {
        const result = await system.validator.validateTemplate(template);

        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      }
    });

    it('should detect invalid TypeScript syntax', async () => {
      const invalidTemplate = {
        id: 'test-invalid',
        name: 'Invalid Template',
        description: 'Test',
        version: '1.0.0',
        author: 'Test',
        category: 'other',
        tags: [],
        difficulty: 'beginner',
        code: 'const x = ;', // Invalid syntax
        mcpServers: [],
        triggerTypes: ['cron'],
        configSchema: { type: 'object', properties: {}, required: [] },
        defaultConfig: {},
        estimatedTokens: 0,
        estimatedDuration: 0,
        tokenReduction: 0,
        useCases: [],
        requiredPermissions: [],
        visibility: 'public',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await system.validator.validateTemplate(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should extract config schema from code', () => {
      const code = `
        const ORG = process.env.GITHUB_ORG || 'default';
        const DAYS = parseInt(process.env.STALE_DAYS || '30');
      `;

      const schema = system.validator.extractConfigSchema(code);

      expect(schema.properties).toHaveProperty('GITHUB_ORG');
      expect(schema.properties).toHaveProperty('STALE_DAYS');
    });
  });

  describe('Template Instantiator', () => {
    it('should create workflow from template', async () => {
      const template = await getTemplateById('github-stale-issues');

      if (template) {
        const workflow = await system.instantiator.instantiate({
          templateId: template.id,
          workflowName: 'Test Workflow',
          repositoryId: 'test-repo',
          agentId: 'test-agent',
          config: {
            GITHUB_ORG: 'testorg',
            STALE_DAYS: 45,
          },
          trigger: {
            type: 'cron',
            cronExpression: '0 9 * * *',
          },
        });

        expect(workflow).toBeDefined();
        expect(workflow.id).toBeDefined();
        expect(workflow.name).toBe('Test Workflow');
        expect(workflow.config.GITHUB_ORG).toBe('testorg');
        expect(workflow.config.STALE_DAYS).toBe(45);
      }
    });

    it('should validate configuration', async () => {
      const template = await getTemplateById('github-stale-issues');

      if (template) {
        // Missing required field
        await expect(
          system.instantiator.instantiate({
            templateId: template.id,
            workflowName: 'Test Workflow',
            repositoryId: 'test-repo',
            agentId: 'test-agent',
            config: {
              // GITHUB_ORG is missing
              STALE_DAYS: 45,
            },
            trigger: {
              type: 'cron',
              cronExpression: '0 9 * * *',
            },
          })
        ).rejects.toThrow();
      }
    });

    it('should merge with default config', async () => {
      const template = await getTemplateById('github-stale-issues');

      if (template) {
        const workflow = await system.instantiator.instantiate({
          templateId: template.id,
          workflowName: 'Test Workflow',
          repositoryId: 'test-repo',
          agentId: 'test-agent',
          config: {
            GITHUB_ORG: 'testorg',
            // STALE_DAYS should use default value
          },
          trigger: {
            type: 'cron',
            cronExpression: '0 9 * * *',
          },
        });

        expect(workflow.config.STALE_DAYS).toBe(30); // Default value
      }
    });
  });

  describe('Workflow Scheduler', () => {
    it('should schedule a workflow', async () => {
      const workflow = {
        id: 'test-workflow-1',
        name: 'Test Workflow',
        userId: 'user-1',
        templateId: 'github-stale-issues',
        repositoryId: 'repo-1',
        agentId: 'agent-1',
        code: 'console.log("test")',
        config: {},
        triggerType: 'cron' as const,
        cronExpression: '0 9 * * *',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await system.scheduler.scheduleWorkflow(workflow);

      const nextExecution = system.scheduler.getNextExecution(workflow.id);
      expect(nextExecution).toBeDefined();
      expect(nextExecution instanceof Date).toBe(true);
    });

    it('should get scheduler stats', () => {
      const stats = system.scheduler.getStats();

      expect(stats).toHaveProperty('scheduledWorkflows');
      expect(stats).toHaveProperty('enabledWorkflows');
      expect(stats).toHaveProperty('isRunning');
    });
  });

  describe('Webhook Handler', () => {
    it('should register webhook for workflow', async () => {
      const workflow = {
        id: 'test-workflow-2',
        name: 'Test Webhook Workflow',
        userId: 'user-1',
        templateId: 'github-stale-issues',
        repositoryId: 'repo-1',
        agentId: 'agent-1',
        code: 'console.log("test")',
        config: {},
        triggerType: 'webhook' as const,
        webhookSecret: 'test-secret-123',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const webhook = await system.webhookHandler.registerWebhook(workflow);

      expect(webhook).toBeDefined();
      expect(webhook.webhookId).toBeDefined();
      expect(webhook.url).toBeDefined();
      expect(webhook.secret).toBe('test-secret-123');
    });

    it('should verify webhook signature', () => {
      const payload = { test: true };
      const secret = 'test-secret';

      // Create signature
      const crypto = require('crypto');
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const verified = system.webhookHandler.verifySignature(
        payload,
        signature,
        secret
      );

      expect(verified).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = { test: true };
      const secret = 'test-secret';
      const invalidSignature = 'sha256=invalid';

      const verified = system.webhookHandler.verifySignature(
        payload,
        invalidSignature,
        secret
      );

      expect(verified).toBe(false);
    });
  });
});
