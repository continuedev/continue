# Technical Specifications: Workflow Templates

**Feature:** Workflow Templates
**Version:** 1.0
**Status:** Draft
**Last Updated:** 2025-11-17

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Components](#system-components)
3. [Data Models](#data-models)
4. [API Specifications](#api-specifications)
5. [Template System](#template-system)
6. [Template Execution](#template-execution)
7. [Security](#security)
8. [Performance](#performance)
9. [Testing Strategy](#testing-strategy)
10. [Deployment](#deployment)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mission Control UI                       │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Template  │  │   Template   │  │    Workflow        │  │
│  │  Gallery   │──│Configuration │──│   Management       │  │
│  └────────────┘  └──────────────┘  └────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS/REST
┌───────────────────────────▼─────────────────────────────────┐
│                   Backend API Server                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Template Service                         │    │
│  │  ├─ Template Registry                               │    │
│  │  ├─ Template Validator                              │    │
│  │  ├─ Template Instantiator                           │    │
│  │  └─ Template Versioning                             │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Workflow Service                         │    │
│  │  ├─ Workflow Scheduler (Cron)                       │    │
│  │  ├─ Webhook Handler                                 │    │
│  │  └─ Execution Queue                                 │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                 Code Mode Execution Engine                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │          E2B Sandbox Manager                        │    │
│  │  ├─ Sandbox Pool                                    │    │
│  │  ├─ Code Injection                                  │    │
│  │  ├─ Environment Variables                           │    │
│  │  └─ Execution Monitoring                            │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │          MCP Connection Manager                     │    │
│  │  ├─ GitHub MCP                                      │    │
│  │  ├─ Filesystem MCP                                  │    │
│  │  ├─ Slack MCP                                       │    │
│  │  └─ Custom MCP Servers                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│     GitHub API  •  Slack API  •  Sentry  •  Snyk            │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: Template Instantiation

```
User Action: "Use Template"
      │
      ▼
[Template Gallery] → Load template metadata
      │
      ▼
[Configuration UI] → Extract config schema from template
      │              Parse environment variables
      │              Display form with defaults
      ▼
User fills config → Validate inputs
      │
      ▼
[Workflow Creation] → Generate workflow config
      │               Inject environment variables
      │               Select agent & repository
      ▼
[Test Execution?] ──YES──→ [E2B Sandbox]
      │                           │
      NO                          ▼
      │                    Execute template code
      │                           │
      │                           ▼
      │                    Return results
      │                           │
      ▼◄──────────────────────────┘
[Save Workflow] → Store in database
      │           Schedule cron or register webhook
      ▼
[Execution] → Run on schedule/trigger
```

### Data Flow: Template Execution

```
Trigger Event (Cron/Webhook)
      │
      ▼
[Workflow Scheduler] → Load workflow config
      │                Load template code
      │                Load repository context
      ▼
[E2B Sandbox] → Provision sandbox environment
      │         Inject config as env vars
      │         Mount MCP server connections
      ▼
[Execute TypeScript] → Run template code
      │                  Call MCP server methods
      │                  Handle errors & retries
      │                  Generate logs
      ▼
[Collect Results] → Capture stdout/stderr
      │              Extract return value
      │              Calculate token usage
      ▼
[Post-Processing] → Save execution logs
      │              Send notifications
      │              Update workflow status
      ▼
[User Dashboard] → Display results
```

---

## System Components

### 1. Template Registry

**Responsibility:** Manage template catalog, metadata, and lifecycle

**Implementation:**
- File-based storage for built-in templates (`/templates` directory)
- Database storage for user/organization templates
- In-memory cache for fast lookups

**Key Methods:**
```typescript
class TemplateRegistry {
  // List all templates with optional filters
  async listTemplates(filters?: TemplateFilters): Promise<TemplateMetadata[]>;

  // Get detailed template by ID
  async getTemplate(templateId: string): Promise<Template>;

  // Register new template (validation included)
  async registerTemplate(template: Template): Promise<string>;

  // Update existing template
  async updateTemplate(templateId: string, updates: Partial<Template>): Promise<void>;

  // Delete template (soft delete)
  async deleteTemplate(templateId: string): Promise<void>;

  // Search templates by keyword
  async searchTemplates(query: string): Promise<TemplateMetadata[]>;
}
```

### 2. Template Validator

**Responsibility:** Validate template code, metadata, and configuration

**Validation Rules:**
- TypeScript syntax is valid
- All imported MCP servers are available
- Configuration schema is well-formed
- Required metadata fields present
- No obvious security vulnerabilities
- Code complexity within limits

**Implementation:**
```typescript
class TemplateValidator {
  // Validate template syntax and structure
  async validateTemplate(template: Template): Promise<ValidationResult>;

  // Extract configuration variables from code
  extractConfigSchema(code: string): ConfigSchema;

  // Check for security issues
  async securityScan(code: string): Promise<SecurityIssue[]>;

  // Verify MCP server dependencies
  verifyDependencies(mcpServers: string[]): boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

### 3. Template Instantiator

**Responsibility:** Create workflow instances from templates with user config

**Implementation:**
```typescript
class TemplateInstantiator {
  // Create workflow from template
  async instantiate(request: InstantiationRequest): Promise<Workflow>;

  // Preview rendered template with config
  async preview(templateId: string, config: TemplateConfig): Promise<string>;

  // Test execute template
  async testRun(templateId: string, config: TemplateConfig): Promise<ExecutionResult>;
}

interface InstantiationRequest {
  templateId: string;
  workflowName: string;
  repositoryId: string;
  agentId: string;
  config: TemplateConfig;
  trigger: TriggerConfig;
}
```

### 4. Workflow Scheduler

**Responsibility:** Execute workflows on schedule (cron triggers)

**Implementation:**
- Uses `node-cron` or similar library
- Persists schedule in database
- Handles timezone conversions
- Supports multiple schedule formats

```typescript
class WorkflowScheduler {
  // Schedule new workflow
  async scheduleWorkflow(workflowId: string, cronExpression: string): Promise<void>;

  // Unschedule workflow
  async unscheduleWorkflow(workflowId: string): Promise<void>;

  // Update schedule
  async updateSchedule(workflowId: string, cronExpression: string): Promise<void>;

  // Get next execution time
  getNextExecution(workflowId: string): Date;
}
```

### 5. Webhook Handler

**Responsibility:** Receive webhook events and trigger workflows

**Implementation:**
```typescript
class WebhookHandler {
  // Register webhook endpoint
  async registerWebhook(workflowId: string): Promise<WebhookConfig>;

  // Handle incoming webhook
  async handleWebhook(webhookId: string, payload: any, headers: Headers): Promise<void>;

  // Verify webhook signature
  verifySignature(payload: any, signature: string, secret: string): boolean;

  // Deregister webhook
  async deregisterWebhook(webhookId: string): Promise<void>;
}
```

### 6. E2B Sandbox Manager

**Responsibility:** Provision and manage E2B sandboxes for code execution

**Implementation:**
```typescript
class E2BSandboxManager {
  // Get or create sandbox for workflow
  async getSandbox(workflowId: string): Promise<Sandbox>;

  // Execute code in sandbox
  async executeCode(
    sandbox: Sandbox,
    code: string,
    env: Record<string, string>,
    mcpConnections: MCPConnection[]
  ): Promise<ExecutionResult>;

  // Clean up sandbox
  async destroySandbox(sandboxId: string): Promise<void>;

  // Monitor sandbox health
  async healthCheck(sandboxId: string): Promise<HealthStatus>;
}
```

---

## Data Models

### Template

```typescript
interface Template {
  // Metadata
  id: string;                    // Unique identifier (e.g., 'github-stale-issues')
  name: string;                  // Display name
  description: string;           // One-sentence description
  longDescription?: string;      // Multi-paragraph description
  version: string;               // Semver (e.g., '1.2.0')
  author: string;                // Author name or 'Code Mode Team'
  createdAt: Date;
  updatedAt: Date;

  // Categorization
  category: TemplateCategory;
  tags: string[];                // Additional tags for search
  difficulty: 'beginner' | 'intermediate' | 'advanced';

  // Technical details
  code: string;                  // TypeScript code
  mcpServers: string[];          // Required MCP servers (e.g., ['github', 'slack'])
  triggerTypes: ('cron' | 'webhook')[];

  // Configuration
  configSchema: ConfigSchema;    // JSON Schema for configuration
  defaultConfig: Record<string, any>;

  // Metrics
  estimatedTokens: number;       // Approximate token usage
  estimatedDuration: number;     // Seconds
  tokenReduction: number;        // Percentage (e.g., 98 for 98%)

  // Documentation
  useCases: string[];            // List of use cases
  exampleOutputUrl?: string;     // Link to example execution
  documentationUrl?: string;     // Link to detailed docs

  // Permissions
  requiredPermissions: string[]; // GitHub scopes, etc.

  // Analytics (computed)
  usageCount?: number;           // How many times used
  successRate?: number;          // Percentage of successful executions
  rating?: number;               // Community rating (0-5)

  // Visibility
  visibility: 'public' | 'private' | 'organization';
  organizationId?: string;
}

type TemplateCategory =
  | 'github-automation'
  | 'code-quality'
  | 'security'
  | 'data-processing'
  | 'devops'
  | 'reporting'
  | 'notifications'
  | 'other';

interface ConfigSchema {
  type: 'object';
  properties: Record<string, ConfigProperty>;
  required: string[];
}

interface ConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  default?: any;
  enum?: any[];           // For select dropdowns
  pattern?: string;       // Regex validation
  minimum?: number;       // For number fields
  maximum?: number;
}
```

### Workflow

```typescript
interface Workflow {
  id: string;
  name: string;
  userId: string;
  organizationId?: string;

  // Source
  templateId?: string;           // If created from template
  templateVersion?: string;      // Version of template used

  // Configuration
  repositoryId: string;
  agentId: string;
  code: string;                  // TypeScript code (may be customized)
  config: Record<string, any>;   // User-provided configuration

  // Trigger
  triggerType: 'cron' | 'webhook';
  cronExpression?: string;
  webhookSecret?: string;

  // Status
  enabled: boolean;
  lastExecutionAt?: Date;
  nextExecutionAt?: Date;

  // Notifications
  notificationConfig?: NotificationConfig;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

### WorkflowExecution

```typescript
interface WorkflowExecution {
  id: string;
  workflowId: string;

  // Trigger
  triggeredBy: 'cron' | 'webhook' | 'manual';
  triggeredAt: Date;
  triggerPayload?: any;          // For webhook triggers

  // Execution
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;             // Milliseconds

  // Results
  result?: any;                  // Return value from code
  logs: ExecutionLog[];
  error?: ExecutionError;

  // Metrics
  tokensUsed: number;
  mcpCallCount: number;

  // Resources
  sandboxId: string;
}

interface ExecutionLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: any;
}

interface ExecutionError {
  message: string;
  stack?: string;
  code?: string;
  isRetryable: boolean;
}
```

---

## API Specifications

### Template API

#### List Templates

```http
GET /api/v1/templates
```

**Query Parameters:**
- `category` (optional): Filter by category
- `triggerType` (optional): Filter by trigger type
- `mcpServer` (optional): Filter by required MCP server
- `difficulty` (optional): Filter by difficulty level
- `search` (optional): Search query
- `limit` (optional): Page size (default: 50)
- `offset` (optional): Page offset (default: 0)

**Response:**
```json
{
  "templates": [
    {
      "id": "github-stale-issues",
      "name": "Stale Issue Manager",
      "description": "Auto-label and comment on inactive issues",
      "category": "github-automation",
      "difficulty": "beginner",
      "mcpServers": ["github"],
      "triggerTypes": ["cron"],
      "tokenReduction": 98,
      "usageCount": 1234,
      "rating": 4.8
    }
  ],
  "total": 22,
  "limit": 50,
  "offset": 0
}
```

#### Get Template Details

```http
GET /api/v1/templates/:templateId
```

**Response:**
```json
{
  "id": "github-stale-issues",
  "name": "Stale Issue Manager",
  "description": "Auto-label and comment on inactive issues",
  "longDescription": "Automatically labels and comments...",
  "version": "1.0.0",
  "author": "Code Mode Team",
  "category": "github-automation",
  "tags": ["github", "issues", "automation"],
  "difficulty": "beginner",
  "code": "import { github } from '/mcp';\n\nconst ORG = ...",
  "mcpServers": ["github"],
  "triggerTypes": ["cron"],
  "configSchema": {
    "type": "object",
    "properties": {
      "githubOrg": {
        "type": "string",
        "description": "GitHub organization name"
      },
      "staleDays": {
        "type": "number",
        "description": "Days before marking stale",
        "default": 30,
        "minimum": 1
      }
    },
    "required": ["githubOrg"]
  },
  "defaultConfig": {
    "staleDays": 30
  },
  "estimatedTokens": 6000,
  "estimatedDuration": 45,
  "tokenReduction": 98,
  "useCases": [
    "Identify abandoned feature requests",
    "Prompt contributors to update status"
  ],
  "requiredPermissions": ["repo:issues:write"],
  "usageCount": 1234,
  "successRate": 99.2,
  "rating": 4.8,
  "createdAt": "2025-01-15T00:00:00Z",
  "updatedAt": "2025-01-15T00:00:00Z"
}
```

#### Create Workflow from Template

```http
POST /api/v1/templates/:templateId/instantiate
```

**Request Body:**
```json
{
  "workflowName": "Daily Stale Issue Check",
  "repositoryId": "repo-123",
  "agentId": "agent-456",
  "config": {
    "githubOrg": "myorg",
    "staleDays": 30
  },
  "trigger": {
    "type": "cron",
    "cronExpression": "0 9 * * *"
  },
  "notificationConfig": {
    "enabled": true,
    "channels": ["email"],
    "notifyOn": ["failure"]
  }
}
```

**Response:**
```json
{
  "workflowId": "workflow-789",
  "name": "Daily Stale Issue Check",
  "status": "created",
  "nextExecution": "2025-11-18T09:00:00Z"
}
```

#### Test Template Execution

```http
POST /api/v1/templates/:templateId/test
```

**Request Body:**
```json
{
  "repositoryId": "repo-123",
  "agentId": "agent-456",
  "config": {
    "githubOrg": "myorg",
    "staleDays": 30
  }
}
```

**Response:**
```json
{
  "executionId": "exec-999",
  "status": "running",
  "estimatedDuration": 45
}
```

**Poll for results:**
```http
GET /api/v1/executions/:executionId
```

**Response:**
```json
{
  "executionId": "exec-999",
  "status": "success",
  "duration": 42,
  "result": {
    "repositoriesAnalyzed": 5,
    "staleIssuesFound": 23,
    "staleIssuesUpdated": 23
  },
  "logs": [
    {
      "timestamp": "2025-11-17T10:00:00Z",
      "level": "info",
      "message": "📊 Found 23 stale issues"
    }
  ],
  "tokensUsed": 5834,
  "mcpCallCount": 87
}
```

### Workflow API

#### Create Custom Workflow

```http
POST /api/v1/workflows
```

**Request Body:**
```json
{
  "name": "Custom PR Analyzer",
  "repositoryId": "repo-123",
  "agentId": "agent-456",
  "code": "import { github } from '/mcp';\n\n// Custom code...",
  "config": {},
  "trigger": {
    "type": "webhook"
  }
}
```

#### List Workflows

```http
GET /api/v1/workflows
```

**Query Parameters:**
- `repositoryId` (optional)
- `status` (optional): `enabled` | `disabled`
- `templateId` (optional): Filter workflows created from specific template

#### Get Workflow Executions

```http
GET /api/v1/workflows/:workflowId/executions
```

**Response:**
```json
{
  "executions": [
    {
      "id": "exec-001",
      "triggeredBy": "cron",
      "triggeredAt": "2025-11-17T09:00:00Z",
      "status": "success",
      "duration": 42000,
      "tokensUsed": 5834
    }
  ],
  "total": 145,
  "limit": 50,
  "offset": 0
}
```

---

## Template System

### Template File Structure

Templates are stored in `/templates` directory:

```
templates/
├── github-automation/
│   ├── stale-issues/
│   │   ├── template.ts          # Template code
│   │   ├── metadata.json        # Template metadata
│   │   ├── README.md            # Documentation
│   │   ├── example-output.json  # Example execution result
│   │   └── test.spec.ts         # Unit tests
│   ├── pr-triage/
│   │   └── ...
│   └── changelog-generator/
│       └── ...
├── security/
│   ├── snyk-scanner/
│   │   └── ...
│   └── ...
└── index.ts                     # Registry index
```

### Template Code Structure

All templates follow this structure:

```typescript
/**
 * Template: [Name]
 * Category: [Category]
 * Description: [One-sentence description]
 *
 * @config GITHUB_ORG - GitHub organization name (required)
 * @config STALE_DAYS - Days before marking stale (default: 30)
 *
 * @mcp github
 * @trigger cron
 *
 * @example
 * // Returns:
 * {
 *   repositoriesAnalyzed: 5,
 *   staleIssuesFound: 23
 * }
 */

import { github } from '/mcp';

// ============================================================
// CONFIGURATION
// ============================================================

const GITHUB_ORG = process.env.GITHUB_ORG || 'default-org';
const STALE_DAYS = parseInt(process.env.STALE_DAYS || '30');

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3
): Promise<T> {
  // ... retry logic
}

// ============================================================
// MAIN WORKFLOW
// ============================================================

async function main() {
  console.log('🚀 Starting stale issue workflow...');

  // Step 1: Fetch data
  // Step 2: Process data
  // Step 3: Update resources

  console.log('✅ Workflow complete!');

  return {
    success: true,
    // ... summary data
  };
}

// ============================================================
// EXECUTION
// ============================================================

const result = await main();

// Return minimal summary to context
return result;
```

### Configuration Extraction

The system automatically extracts configuration from code comments and environment variable usage:

```typescript
// Parser looks for patterns like:
const VAR_NAME = process.env.VAR_NAME || 'default-value';
const VAR_NAME = parseInt(process.env.VAR_NAME || '30');
const VAR_NAME = process.env.VAR_NAME; // Required (no default)

// Generates schema:
{
  "type": "object",
  "properties": {
    "VAR_NAME": {
      "type": "string",
      "description": "Extracted from @config comment",
      "default": "default-value"
    }
  },
  "required": ["VAR_NAME"] // If no default value
}
```

### Template Validation Pipeline

```typescript
async function validateTemplate(template: Template): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Syntax validation
  try {
    const ast = parseTypeScript(template.code);
  } catch (err) {
    errors.push({ type: 'syntax', message: err.message });
  }

  // 2. Import validation
  const imports = extractImports(template.code);
  for (const imp of imports) {
    if (!availableMCPServers.includes(imp)) {
      errors.push({
        type: 'import',
        message: `Unknown MCP server: ${imp}`
      });
    }
  }

  // 3. Security scan
  const securityIssues = await scanForSecurityIssues(template.code);
  errors.push(...securityIssues);

  // 4. Complexity check
  const complexity = calculateComplexity(template.code);
  if (complexity > 50) {
    warnings.push({
      type: 'complexity',
      message: `High complexity: ${complexity} (max recommended: 50)`
    });
  }

  // 5. Best practices
  if (!hasErrorHandling(template.code)) {
    warnings.push({
      type: 'best-practice',
      message: 'Template should include try-catch blocks'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## Template Execution

### Execution Lifecycle

```
1. TRIGGER
   ├─ Cron schedule reached
   └─ Webhook received

2. PREPARATION
   ├─ Load workflow config
   ├─ Load template code
   ├─ Load repository context
   └─ Validate inputs

3. SANDBOX PROVISIONING
   ├─ Get or create E2B sandbox
   ├─ Inject environment variables
   ├─ Mount MCP server connections
   └─ Set up logging

4. CODE EXECUTION
   ├─ Transpile TypeScript to JavaScript
   ├─ Execute in sandbox
   ├─ Stream logs in real-time
   └─ Monitor resource usage

5. MCP CALLS
   ├─ Intercept MCP method calls
   ├─ Route to appropriate MCP server
   ├─ Handle authentication
   └─ Return results to sandbox

6. COMPLETION
   ├─ Capture return value
   ├─ Collect execution logs
   ├─ Calculate metrics
   └─ Clean up sandbox

7. POST-PROCESSING
   ├─ Save execution record
   ├─ Send notifications
   ├─ Update workflow state
   └─ Trigger webhooks (if configured)
```

### Code Injection

Template code is injected into E2B sandbox with MCP wrapper:

```typescript
async function executeTemplate(
  code: string,
  config: Record<string, string>,
  mcpServers: MCPConnection[]
): Promise<ExecutionResult> {
  // 1. Build MCP proxy code
  const mcpProxy = generateMCPProxy(mcpServers);

  // 2. Inject configuration
  const envVars = Object.entries(config)
    .map(([key, value]) => `process.env.${key} = '${value}';`)
    .join('\n');

  // 3. Wrap template code
  const wrappedCode = `
    // MCP Proxy Setup
    ${mcpProxy}

    // Configuration Injection
    ${envVars}

    // Template Code
    (async () => {
      try {
        ${code}
      } catch (error) {
        console.error('Template execution failed:', error);
        throw error;
      }
    })();
  `;

  // 4. Execute in E2B
  const result = await sandbox.runCode(wrappedCode);

  return result;
}
```

### MCP Proxy Generation

```typescript
function generateMCPProxy(mcpServers: MCPConnection[]): string {
  const proxies = mcpServers.map(server => {
    return `
      const ${server.name} = new Proxy({}, {
        get(target, method) {
          return async (...args) => {
            // Call MCP server via IPC
            const result = await __mcp_call('${server.name}', method, args);
            return result;
          };
        }
      });
    `;
  });

  return `
    // MCP Server Proxies
    ${proxies.join('\n')}

    // Export for imports
    export { ${mcpServers.map(s => s.name).join(', ')} };
  `;
}
```

### Error Handling

Templates have layered error handling:

```typescript
// 1. Template-level error handling (user code)
try {
  const result = await github.listIssues({ ... });
} catch (error) {
  console.error('Failed to fetch issues:', error);
  // Handle gracefully
}

// 2. Wrapper-level error handling (Code Mode)
try {
  const templateResult = await executeTemplate(...);
} catch (error) {
  if (isRetryableError(error)) {
    await retryExecution(...);
  } else {
    await failWorkflow(workflowId, error);
  }
}

// 3. MCP-level error handling
async function mcpCall(server, method, args) {
  try {
    return await server[method](...args);
  } catch (error) {
    if (error.code === 'RATE_LIMIT') {
      await sleep(60000);
      return await mcpCall(server, method, args); // Retry
    }
    throw error;
  }
}
```

---

## Security

### Sandbox Isolation

- All template code executes in E2B Firecracker sandboxes
- No access to host filesystem
- Network access restricted to approved endpoints
- Resource limits enforced (CPU, memory, execution time)

### Secret Management

```typescript
// Secrets are NOT injected as environment variables
// Instead, they're available via secure API:

const githubToken = await secrets.get('GITHUB_TOKEN');

// In template code:
const octokit = new Octokit({
  auth: await secrets.get('GITHUB_TOKEN')
});
```

### Code Review Requirements

All public templates must pass security review:

1. **Static Analysis**
   - No eval(), Function(), or dynamic code execution
   - No process.exit() or process.kill()
   - No require() of unauthorized modules
   - No file system access outside `/tmp`

2. **Manual Review**
   - Reviewer checks for malicious intent
   - Verifies error handling
   - Confirms least-privilege MCP usage

3. **Test Execution**
   - Template runs in isolated environment
   - Monitored for suspicious behavior
   - Network traffic analyzed

### Rate Limiting

```typescript
// Per-workflow rate limits
{
  maxExecutionsPerHour: 10,
  maxExecutionsPerDay: 100,
  maxConcurrentExecutions: 5,
  maxExecutionDuration: 600 // seconds
}

// Per-user limits
{
  maxWorkflows: 50,
  maxTemplateCreations: 10 // per day
}
```

---

## Performance

### Optimization Strategies

1. **Template Caching**
   - Compiled templates cached in memory
   - Cache invalidated on update
   - Shared across workflow instances

2. **Sandbox Pooling**
   - Pre-warmed sandbox pool
   - Reduces cold start time from 3s to 200ms
   - Pool size scales with load

3. **Parallel Execution**
   - Multiple workflows execute concurrently
   - Queue management prevents overload
   - Priority queue for time-sensitive workflows

4. **Database Optimization**
   - Indexed queries on workflowId, templateId, userId
   - Execution logs stored in time-series database
   - Archival of old executions (>90 days)

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Template gallery load time | <1s | 95th percentile |
| Workflow instantiation | <500ms | Average |
| Sandbox provisioning | <200ms | Average (pooled) |
| Template compilation | <100ms | Average |
| API response time | <200ms | 95th percentile |
| Concurrent workflows | 1000+ | Peak load |
| Execution throughput | 10,000/hour | Sustained |

### Monitoring

```typescript
// Key metrics to track
{
  templateUsage: {
    byTemplate: Map<string, number>,
    byCategory: Map<string, number>,
    byUser: Map<string, number>
  },

  executionMetrics: {
    successRate: number,
    averageDuration: number,
    p95Duration: number,
    failureReasons: Map<string, number>
  },

  resourceUsage: {
    activeSandboxes: number,
    queueDepth: number,
    cpuUsage: number,
    memoryUsage: number
  },

  apiMetrics: {
    requestsPerSecond: number,
    errorRate: number,
    p95ResponseTime: number
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// Template validation tests
describe('TemplateValidator', () => {
  it('should validate correct template', async () => {
    const template = loadTemplate('github-stale-issues');
    const result = await validator.validateTemplate(template);
    expect(result.valid).toBe(true);
  });

  it('should reject template with invalid syntax', async () => {
    const template = { ...validTemplate, code: 'invalid typescript!' };
    const result = await validator.validateTemplate(template);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ type: 'syntax' })
    );
  });
});

// Configuration extraction tests
describe('ConfigExtractor', () => {
  it('should extract config variables from code', () => {
    const code = `
      const ORG = process.env.GITHUB_ORG || 'default';
      const DAYS = parseInt(process.env.STALE_DAYS || '30');
    `;
    const schema = extractor.extractConfigSchema(code);
    expect(schema.properties).toHaveProperty('GITHUB_ORG');
    expect(schema.properties).toHaveProperty('STALE_DAYS');
  });
});
```

### Integration Tests

```typescript
// End-to-end workflow tests
describe('Template Workflow', () => {
  it('should create and execute workflow from template', async () => {
    // 1. Instantiate template
    const workflow = await templateService.instantiate({
      templateId: 'github-stale-issues',
      workflowName: 'Test Workflow',
      repositoryId: 'test-repo',
      agentId: 'test-agent',
      config: {
        githubOrg: 'test-org',
        staleDays: 30
      },
      trigger: { type: 'manual' }
    });

    expect(workflow).toBeDefined();

    // 2. Execute workflow
    const execution = await workflowService.execute(workflow.id);

    // 3. Wait for completion
    await waitForCompletion(execution.id);

    // 4. Verify results
    const result = await executionService.getExecution(execution.id);
    expect(result.status).toBe('success');
    expect(result.result).toHaveProperty('staleIssuesFound');
  });
});
```

### Template Tests

Each template includes its own test suite:

```typescript
// templates/github-automation/stale-issues/test.spec.ts
describe('Stale Issues Template', () => {
  let mockGitHub: MockMCPServer;

  beforeEach(() => {
    mockGitHub = new MockMCPServer('github');
    mockGitHub.mockMethod('listIssues', [
      { number: 1, updated_at: '2024-01-01', labels: [] },
      { number: 2, updated_at: '2025-11-01', labels: [] }
    ]);
  });

  it('should identify stale issues', async () => {
    const result = await executeTemplate(templateCode, {
      GITHUB_ORG: 'test-org',
      STALE_DAYS: '30'
    }, [mockGitHub]);

    expect(result.staleIssuesFound).toBe(1);
    expect(mockGitHub.calledMethods).toContain('addLabels');
  });

  it('should handle rate limits gracefully', async () => {
    mockGitHub.mockError('listIssues', { code: 'RATE_LIMIT' });

    const result = await executeTemplate(templateCode, config, [mockGitHub]);

    // Should retry and eventually succeed
    expect(result.status).toBe('success');
  });
});
```

### Load Tests

```typescript
// Simulate concurrent workflow executions
describe('Load Test', () => {
  it('should handle 1000 concurrent executions', async () => {
    const workflows = Array.from({ length: 1000 }, (_, i) => ({
      id: `workflow-${i}`,
      templateId: 'github-stale-issues',
      config: { /* ... */ }
    }));

    const startTime = Date.now();

    await Promise.all(
      workflows.map(w => workflowService.execute(w.id))
    );

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(60000); // Complete within 1 minute
  });
});
```

---

## Deployment

### Build Process

```bash
# 1. Compile TypeScript
npm run build

# 2. Validate all templates
npm run validate:templates

# 3. Run tests
npm run test

# 4. Bundle templates
npm run bundle:templates

# 5. Generate template registry
npm run generate:registry

# 6. Build Docker image
docker build -t code-mode:latest .
```

### Template Registry Generation

```typescript
// scripts/generate-registry.ts
async function generateRegistry() {
  const templates = await loadAllTemplates('/templates');

  // Validate each template
  for (const template of templates) {
    const validation = await validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${template.id}`);
    }
  }

  // Generate index
  const registry = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    templates: templates.map(t => ({
      id: t.id,
      path: t.path,
      metadata: extractMetadata(t)
    }))
  };

  // Write to file
  await fs.writeFile(
    '/dist/template-registry.json',
    JSON.stringify(registry, null, 2)
  );
}
```

### Database Migrations

```sql
-- Migration: Create template tables

CREATE TABLE templates (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  code TEXT NOT NULL,
  metadata JSONB,
  visibility VARCHAR(20) DEFAULT 'public',
  organization_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_category (category),
  INDEX idx_visibility (visibility),
  INDEX idx_organization (organization_id)
);

CREATE TABLE workflows (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  organization_id VARCHAR(255),
  template_id VARCHAR(255),
  template_version VARCHAR(50),
  repository_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  code TEXT NOT NULL,
  config JSONB,
  trigger_type VARCHAR(20) NOT NULL,
  cron_expression VARCHAR(100),
  webhook_secret VARCHAR(255),
  enabled BOOLEAN DEFAULT true,
  last_execution_at TIMESTAMP,
  next_execution_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_user (user_id),
  INDEX idx_template (template_id),
  INDEX idx_enabled (enabled),
  INDEX idx_next_execution (next_execution_at),
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

CREATE TABLE workflow_executions (
  id VARCHAR(255) PRIMARY KEY,
  workflow_id VARCHAR(255) NOT NULL,
  triggered_by VARCHAR(20) NOT NULL,
  triggered_at TIMESTAMP NOT NULL,
  trigger_payload JSONB,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  result JSONB,
  error JSONB,
  tokens_used INTEGER,
  mcp_call_count INTEGER,
  sandbox_id VARCHAR(255),

  INDEX idx_workflow (workflow_id),
  INDEX idx_status (status),
  INDEX idx_triggered_at (triggered_at),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

CREATE TABLE execution_logs (
  id SERIAL PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,

  INDEX idx_execution (execution_id),
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id)
);
```

### Environment Configuration

```bash
# .env.production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/codemode

# E2B Sandbox
E2B_API_KEY=sk_xxx
E2B_SANDBOX_TEMPLATE=code-mode-v1

# MCP Servers
MCP_GITHUB_ENABLED=true
MCP_SLACK_ENABLED=true
MCP_FILESYSTEM_ENABLED=true

# Template Settings
TEMPLATE_REGISTRY_PATH=/app/templates
TEMPLATE_CACHE_TTL=3600
MAX_TEMPLATE_SIZE_KB=500

# Execution Limits
MAX_EXECUTION_DURATION_SEC=600
MAX_CONCURRENT_WORKFLOWS=1000
SANDBOX_POOL_SIZE=100

# Notifications
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=xxx
```

### Monitoring & Alerting

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'code-mode-templates'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'

# Alert rules
groups:
  - name: template_alerts
    rules:
      - alert: HighTemplateFailureRate
        expr: rate(template_executions_failed[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High template failure rate"

      - alert: SandboxPoolExhausted
        expr: sandbox_pool_available < 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Sandbox pool running low"
```

---

## Future Enhancements (v2+)

1. **Template Marketplace**
   - Community-contributed templates
   - Template ratings and reviews
   - Premium templates
   - Template analytics (popularity, success rate)

2. **Visual Template Builder**
   - Drag-and-drop workflow designer
   - Generate TypeScript from visual flow
   - Live preview

3. **Template Composition**
   - Chain multiple templates
   - Share data between templates
   - Conditional execution

4. **AI-Powered Template Generation**
   - Natural language → template code
   - Suggest templates based on repository
   - Auto-optimize templates for token usage

5. **Advanced Scheduling**
   - Timezone-aware schedules
   - Holiday/weekend awareness
   - Dynamic scheduling based on repository activity

6. **Template Versioning**
   - Semantic versioning for templates
   - Upgrade notifications
   - Backward compatibility checks
   - Auto-migration on breaking changes

---

## Appendix

### A. Complete Template Example

See: `/templates/github-automation/stale-issues/template.ts`

### B. MCP Server Specifications

See: `/docs/mcp/server-specs.md`

### C. E2B Sandbox Configuration

See: `/docs/infrastructure/e2b-setup.md`

### D. API Authentication

See: `/docs/api/authentication.md`

---

## References

- Code Mode Architecture: `/docs/architecture/overview.md`
- Workflow Documentation: `/docs/mission-control/workflows.mdx`
- MCP Protocol Specification: https://modelcontextprotocol.io
- E2B Documentation: https://e2b.dev/docs

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-17 | Code Mode Team | Initial technical specifications |
