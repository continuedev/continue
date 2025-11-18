# Workflow Templates

> 98% token reduction for AI agents via MCP code execution

The Workflow Templates module enables Code Mode to execute pre-built TypeScript workflows on a schedule or via webhooks, dramatically reducing token usage while maintaining full AI agent capabilities.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Components](#core-components)
- [Getting Started](#getting-started)
- [Creating Templates](#creating-templates)
- [Using Templates](#using-templates)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Performance](#performance)

## Overview

### What are Workflow Templates?

Workflow Templates are pre-written TypeScript code snippets that can be configured and executed on a schedule (cron) or triggered via webhooks. They leverage Model Context Protocol (MCP) servers to interact with external services like GitHub, Slack, Sentry, etc.

### Key Benefits

- **98% Token Reduction**: Execute complex workflows with minimal token usage
- **Reusable**: Create once, use many times across different repositories
- **Configurable**: Each template exposes configuration variables
- **Scheduled**: Run on cron schedules or webhook triggers
- **Secure**: Execute in isolated E2B sandboxes
- **Observable**: Comprehensive logging and metrics

### Example Use Cases

1. **GitHub Automation**
   - Auto-label stale issues
   - Triage new pull requests
   - Generate changelogs
   - Update project boards

2. **Code Quality**
   - Run Snyk security scans
   - Generate test coverage reports
   - Lint code changes
   - Check for breaking changes

3. **Reporting**
   - Daily activity summaries
   - Weekly metrics reports
   - Monthly analytics dashboards

4. **Notifications**
   - Slack alerts for critical issues
   - Email digests
   - Status updates to stakeholders

## Architecture

```
┌─────────────────┐
│  User Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│   Template Registry         │ ← Manages template catalog
│   - Load from disk/DB       │
│   - Cache in memory         │
│   - Search & filter         │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│   Template Validator        │ ← Validates template code
│   - Syntax checking         │
│   - Security scanning       │
│   - Dependency verification │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│   Template Instantiator     │ ← Creates workflows
│   - Merge config            │
│   - Validate inputs         │
│   - Generate workflow       │
└────────┬────────────────────┘
         │
         ├─────────────────────┐
         │                     │
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│ Workflow         │  │ Webhook          │
│ Scheduler        │  │ Handler          │
│ - Cron jobs      │  │ - HTTP endpoints │
│ - Queue          │  │ - Signature      │
│ - Execution      │  │ - Routing        │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         └──────────┬──────────┘
                    ▼
         ┌──────────────────────┐
         │ E2B Sandbox Manager  │
         │ - Provision sandbox  │
         │ - Inject config      │
         │ - Execute code       │
         │ - Collect results    │
         └──────────────────────┘
```

## Core Components

### 1. Template Registry

Manages the template catalog and metadata.

```typescript
import { getTemplateRegistry } from './workflows';

const registry = getTemplateRegistry('./templates');
await registry.initialize();

// List all templates
const templates = await registry.listTemplates({
  category: 'github-automation',
  difficulty: 'beginner'
});

// Get specific template
const template = await registry.getTemplate('github-stale-issues');
```

### 2. Template Validator

Validates template code and configuration.

```typescript
import { TemplateValidator } from './workflows';

const validator = new TemplateValidator();
const result = await validator.validateTemplate(template);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

### 3. Template Instantiator

Creates workflow instances from templates.

```typescript
import { TemplateInstantiator } from './workflows';

const instantiator = new TemplateInstantiator(registry, sandboxManager);

const workflow = await instantiator.instantiate({
  templateId: 'github-stale-issues',
  workflowName: 'Daily Stale Issue Check',
  repositoryId: 'repo-123',
  agentId: 'agent-456',
  config: {
    GITHUB_ORG: 'myorg',
    STALE_DAYS: 30
  },
  trigger: {
    type: 'cron',
    cronExpression: '0 9 * * *'
  }
});
```

### 4. Workflow Scheduler

Manages cron-based execution.

```typescript
import { WorkflowScheduler } from './workflows';

const scheduler = new WorkflowScheduler(sandboxManager);
scheduler.start();

// Schedule a workflow
await scheduler.scheduleWorkflow(workflow);

// Get next execution time
const nextRun = scheduler.getNextExecution(workflow.id);
```

### 5. Webhook Handler

Handles webhook-triggered workflows.

```typescript
import { WebhookHandler } from './workflows';

const webhookHandler = new WebhookHandler();

// Register webhook for workflow
const webhook = await webhookHandler.registerWebhook(workflow);
console.log('Webhook URL:', webhook.url);

// Handle incoming webhook
await webhookHandler.handleWebhook(
  webhookId,
  payload,
  headers
);
```

### 6. E2B Sandbox Manager

Executes template code in isolated sandboxes.

```typescript
import { E2BSandboxManager } from './workflows';

const sandboxManager = new E2BSandboxManager();

const result = await sandboxManager.executeTemplate(
  executionId,
  templateCode,
  config,
  mcpServers,
  repositoryId
);
```

## Getting Started

### Installation

The workflow templates module is part of the Code Mode core:

```bash
cd core
npm install
```

### Environment Variables

```bash
# E2B API Key (required for execution)
E2B_API_KEY=your_e2b_api_key

# Template directory (default: ./templates)
TEMPLATE_DIR=/path/to/templates

# Webhook base URL (for webhook triggers)
WEBHOOK_BASE_URL=https://api.codemode.dev

# Database connection (for persistence)
DATABASE_URL=postgresql://user:pass@host:5432/codemode
```

### Initialize the System

```typescript
import { initializeWorkflowSystem } from './core/workflows';

const system = await initializeWorkflowSystem('./templates');

// Access components
const { registry, scheduler, webhookHandler } = system;
```

## Creating Templates

### Template Structure

```
templates/
├── github-automation/
│   ├── stale-issues/
│   │   ├── template.ts          # Template code
│   │   ├── metadata.json        # Template metadata
│   │   ├── README.md            # Documentation
│   │   └── test.spec.ts         # Tests (optional)
```

### Template Code

```typescript
/**
 * Template: [Name]
 * Category: [category]
 * Description: [One-sentence description]
 *
 * @config VAR_NAME - Variable description (required/optional)
 * @mcp github
 * @trigger cron
 */

import { github } from '/mcp';

// Configuration
const VAR_NAME = process.env.VAR_NAME || 'default';

// Main workflow
async function main() {
  console.log('🚀 Starting workflow...');

  // Your code here
  const result = await github.listIssues({ ... });

  console.log('✅ Workflow complete!');

  return {
    success: true,
    // ... summary data
  };
}

// Execute
const result = await main();
return result;
```

### Metadata File

```json
{
  "id": "github-stale-issues",
  "name": "Stale Issue Manager",
  "description": "Auto-label and comment on inactive issues",
  "version": "1.0.0",
  "author": "Code Mode Team",
  "category": "github-automation",
  "tags": ["github", "issues", "automation"],
  "difficulty": "beginner",
  "mcpServers": ["github"],
  "triggerTypes": ["cron"],
  "configSchema": {
    "type": "object",
    "properties": {
      "GITHUB_ORG": {
        "type": "string",
        "description": "GitHub organization name"
      }
    },
    "required": ["GITHUB_ORG"]
  },
  "defaultConfig": {},
  "estimatedTokens": 6000,
  "estimatedDuration": 45,
  "tokenReduction": 98,
  "useCases": ["Identify abandoned issues"],
  "requiredPermissions": ["repo:issues:write"],
  "visibility": "public"
}
```

### Template Guidelines

1. **Use descriptive names**: Choose clear, action-oriented names
2. **Include error handling**: Wrap API calls in try-catch blocks
3. **Add logging**: Use console.log for debugging
4. **Return results**: Always return a summary object
5. **Document configuration**: Explain each config variable
6. **Test thoroughly**: Include unit tests
7. **Follow security best practices**: No hardcoded secrets

## Using Templates

### Via Code

```typescript
import { createWorkflowFromTemplate } from './core/workflows';

const workflow = await createWorkflowFromTemplate({
  templateId: 'github-stale-issues',
  workflowName: 'Daily Stale Issue Check',
  repositoryId: 'repo-123',
  agentId: 'agent-456',
  config: {
    GITHUB_ORG: 'myorg',
    STALE_DAYS: 30
  },
  trigger: {
    type: 'cron',
    cronExpression: '0 9 * * *'
  }
});
```

### Via API (Future)

```bash
# List templates
GET /api/v1/templates

# Get template details
GET /api/v1/templates/:templateId

# Create workflow from template
POST /api/v1/templates/:templateId/instantiate
{
  "workflowName": "Daily Check",
  "repositoryId": "repo-123",
  "agentId": "agent-456",
  "config": { ... },
  "trigger": { ... }
}

# Test template
POST /api/v1/templates/:templateId/test
```

## API Reference

See [types.ts](./types.ts) for complete type definitions.

### Key Types

- **Template**: Template definition with code and metadata
- **Workflow**: Instantiated workflow from a template
- **WorkflowExecution**: Record of a workflow execution
- **ConfigSchema**: JSON Schema for template configuration
- **ValidationResult**: Result of template validation

## Database Schema

See [migrations/001_create_workflow_tables.sql](./migrations/001_create_workflow_tables.sql) for the complete schema.

### Main Tables

- `templates`: Template definitions
- `workflows`: Workflow instances
- `workflow_executions`: Execution records
- `execution_logs`: Detailed execution logs
- `webhooks`: Webhook configurations

## Testing

### Unit Tests

```bash
cd core
npm test workflows/
```

### Template Tests

```typescript
// templates/github-automation/stale-issues/test.spec.ts
describe('Stale Issues Template', () => {
  it('should identify stale issues', async () => {
    const result = await executeTemplate(code, config, mockMCP);
    expect(result.staleIssuesFound).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
describe('Template System Integration', () => {
  it('should create and execute workflow', async () => {
    const workflow = await createWorkflowFromTemplate(request);
    const execution = await scheduler.manualTrigger(workflow.id);
    expect(execution.status).toBe('success');
  });
});
```

## Performance

### Metrics

- **Template load time**: <100ms (cached)
- **Workflow instantiation**: <500ms
- **Sandbox provisioning**: <200ms (pooled)
- **Execution throughput**: 10,000+ workflows/hour

### Optimization Tips

1. **Use template caching**: Templates are cached in memory
2. **Pool sandboxes**: Pre-warm sandboxes for faster execution
3. **Batch operations**: Group API calls when possible
4. **Index database**: Ensure proper indexes on frequently queried fields
5. **Monitor metrics**: Track execution times and token usage

## Contributing

### Adding New Templates

1. Create template directory
2. Write template code
3. Create metadata.json
4. Add README.md
5. Write tests
6. Submit PR

### Template Review Checklist

- [ ] Code follows template structure
- [ ] Metadata is complete and accurate
- [ ] Configuration schema is well-defined
- [ ] Error handling is implemented
- [ ] Logging is comprehensive
- [ ] Tests are included
- [ ] Documentation is clear
- [ ] Security scan passes

## License

Apache 2.0 - See [LICENSE](../../../LICENSE)

## Support

- GitHub Issues: https://github.com/Connorbelez/codeMode/issues
- Documentation: https://docs.codemode.dev
- Discord: https://discord.gg/codemode
