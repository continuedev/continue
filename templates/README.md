# Workflow Templates Gallery

> Pre-built workflow templates for Code Mode - 98% token reduction for AI agents

This directory contains official and community workflow templates that can be used to automate common development tasks with minimal token usage.

## Template Categories

### GitHub Automation
Templates for automating GitHub workflows and repository management.

- **[Stale Issue Manager](./github-automation/stale-issues/)** - Auto-label and comment on inactive issues
- **[PR Triage](./github-automation/pr-triage/)** - Automatically triage and label new pull requests

### Security
Templates for security scanning and vulnerability management.

- **[Snyk Scanner](./security/snyk-scanner/)** - Automated security vulnerability scanning

## Quick Start

### Using a Template

1. **Browse templates** in this directory
2. **Choose a template** that fits your use case
3. **Configure** the template with your settings
4. **Schedule or trigger** the workflow

### Example

```typescript
import { createWorkflowFromTemplate } from './core/workflows';

const workflow = await createWorkflowFromTemplate({
  templateId: 'github-stale-issues',
  workflowName: 'Daily Stale Issue Check',
  repositoryId: 'my-repo',
  agentId: 'my-agent',
  config: {
    GITHUB_ORG: 'myorg',
    STALE_DAYS: 30,
    STALE_LABEL: 'stale',
  },
  trigger: {
    type: 'cron',
    cronExpression: '0 9 * * *', // Daily at 9 AM
  },
});
```

## Template Structure

Each template follows this structure:

```
template-name/
├── template.ts          # Main template code (TypeScript)
├── metadata.json        # Template metadata and configuration schema
├── README.md            # Template documentation
├── example-output.json  # Example execution result (optional)
└── test.spec.ts         # Unit tests (optional)
```

## Creating Your Own Template

### 1. Create Template Directory

```bash
mkdir -p templates/category-name/template-name
cd templates/category-name/template-name
```

### 2. Create Template Code

Create `template.ts`:

```typescript
/**
 * Template: [Name]
 * Category: [category]
 * Description: [One-sentence description]
 *
 * @config VAR_NAME - Variable description
 * @mcp github
 * @trigger cron
 */

import { github } from '/mcp';

// Configuration from environment variables
const VAR_NAME = process.env.VAR_NAME || 'default';

// Main workflow function
async function main() {
  console.log('🚀 Starting workflow...');

  // Your workflow logic here
  const data = await github.someMethod({ ... });

  console.log('✅ Workflow complete!');

  return {
    success: true,
    summary: 'Your results here',
  };
}

// Execute and return result
const result = await main();
return result;
```

### 3. Create Metadata

Create `metadata.json`:

```json
{
  "id": "unique-template-id",
  "name": "Template Display Name",
  "description": "One-sentence description",
  "version": "1.0.0",
  "author": "Your Name",
  "category": "category-name",
  "tags": ["tag1", "tag2"],
  "difficulty": "beginner",
  "mcpServers": ["github"],
  "triggerTypes": ["cron"],
  "configSchema": {
    "type": "object",
    "properties": {
      "VAR_NAME": {
        "type": "string",
        "description": "Variable description",
        "default": "default-value"
      }
    },
    "required": []
  },
  "defaultConfig": {},
  "estimatedTokens": 5000,
  "estimatedDuration": 30,
  "tokenReduction": 98,
  "useCases": ["Use case 1", "Use case 2"],
  "requiredPermissions": ["permission1"],
  "visibility": "public"
}
```

### 4. Create Documentation

Create `README.md` with:
- Overview
- Configuration options
- Example usage
- Output format
- Required permissions

### 5. Test Your Template

Create `test.spec.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';

describe('My Template', () => {
  it('should execute successfully', async () => {
    // Your tests here
  });
});
```

## Template Guidelines

### Code Style

1. **Use TypeScript**: All templates must be written in TypeScript
2. **Include JSDoc comments**: Document your code
3. **Add logging**: Use console.log for execution progress
4. **Handle errors**: Include try-catch blocks
5. **Return results**: Always return a summary object

### Security

1. **No hardcoded secrets**: Use environment variables
2. **Validate inputs**: Check configuration values
3. **Use least privilege**: Request only necessary permissions
4. **Avoid dangerous operations**: No eval(), process.exit(), etc.

### Best Practices

1. **Keep it focused**: One template, one task
2. **Make it reusable**: Use configuration for customization
3. **Add retry logic**: Handle transient failures
4. **Document everything**: README, JSDoc, inline comments
5. **Test thoroughly**: Include unit tests

## Available MCP Servers

Templates can use these MCP servers:

- `github` - GitHub API integration
- `slack` - Slack messaging
- `filesystem` - File system operations
- `sentry` - Error monitoring
- `snyk` - Security scanning
- `supabase` - Database operations
- `netlify` - Deployment management
- `notion` - Notion workspace
- `chrome-devtools` - Browser automation
- `atlassian` - Jira/Confluence
- `dlt` - Data loading
- `posthog` - Analytics
- `sanity` - Content management

## Cron Expression Examples

Common scheduling patterns:

```
0 9 * * *        # Daily at 9 AM
0 0 * * 0        # Weekly on Sunday at midnight
0 0 1 * *        # Monthly on the 1st at midnight
*/30 * * * *     # Every 30 minutes
0 0 * * 1-5      # Weekdays at midnight
```

## Template Difficulty Levels

- **Beginner**: Simple, single-purpose templates with minimal configuration
- **Intermediate**: Multi-step workflows with moderate complexity
- **Advanced**: Complex workflows with advanced features

## Contributing

We welcome community contributions! To submit a template:

1. Fork the repository
2. Create your template following the guidelines
3. Test thoroughly
4. Submit a pull request
5. Include:
   - Template code and metadata
   - README with documentation
   - Tests (if applicable)
   - Example output

## Template Review Process

All templates go through review for:

1. **Code quality**: Follows guidelines and best practices
2. **Security**: No vulnerabilities or unsafe code
3. **Documentation**: Complete and clear
4. **Testing**: Includes tests or has been manually tested
5. **Usefulness**: Solves a real problem

## Support

- **Issues**: [GitHub Issues](https://github.com/Connorbelez/codeMode/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Connorbelez/codeMode/discussions)
- **Documentation**: [Code Mode Docs](https://docs.codemode.dev)

## License

All templates are licensed under Apache 2.0 unless otherwise specified.
