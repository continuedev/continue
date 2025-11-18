/**
 * Workflow Templates Type Definitions
 *
 * This file contains all the core type definitions for the workflow templates feature.
 * Based on the technical specification v1.0
 */

// ============================================================
// TEMPLATE TYPES
// ============================================================

export type TemplateCategory =
  | 'github-automation'
  | 'code-quality'
  | 'security'
  | 'data-processing'
  | 'devops'
  | 'reporting'
  | 'notifications'
  | 'other';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type Visibility = 'public' | 'private' | 'organization';

export interface ConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  default?: any;
  enum?: any[];           // For select dropdowns
  pattern?: string;       // Regex validation
  minimum?: number;       // For number fields
  maximum?: number;
}

export interface ConfigSchema {
  type: 'object';
  properties: Record<string, ConfigProperty>;
  required: string[];
}

export interface Template {
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
  difficulty: Difficulty;

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
  visibility: Visibility;
  organizationId?: string;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  difficulty: Difficulty;
  mcpServers: string[];
  triggerTypes: ('cron' | 'webhook')[];
  tokenReduction: number;
  usageCount?: number;
  rating?: number;
  author: string;
  version: string;
  tags: string[];
}

export interface TemplateFilters {
  category?: TemplateCategory;
  triggerType?: 'cron' | 'webhook';
  mcpServer?: string;
  difficulty?: Difficulty;
  search?: string;
}

// ============================================================
// WORKFLOW TYPES
// ============================================================

export interface NotificationConfig {
  enabled: boolean;
  channels: ('email' | 'slack' | 'webhook')[];
  notifyOn: ('success' | 'failure' | 'always')[];
  webhookUrl?: string;
  slackChannel?: string;
  emailRecipients?: string[];
}

export interface Workflow {
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

// ============================================================
// EXECUTION TYPES
// ============================================================

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type ExecutionTrigger = 'cron' | 'webhook' | 'manual';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ExecutionLog {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: any;
}

export interface ExecutionError {
  message: string;
  stack?: string;
  code?: string;
  isRetryable: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;

  // Trigger
  triggeredBy: ExecutionTrigger;
  triggeredAt: Date;
  triggerPayload?: any;          // For webhook triggers

  // Execution
  status: ExecutionStatus;
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

// ============================================================
// VALIDATION TYPES
// ============================================================

export interface ValidationError {
  type: 'syntax' | 'import' | 'security' | 'complexity' | 'best-practice';
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationWarning {
  type: 'complexity' | 'best-practice' | 'performance';
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface SecurityIssue extends ValidationError {
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation?: string;
}

// ============================================================
// SERVICE REQUEST/RESPONSE TYPES
// ============================================================

export interface TriggerConfig {
  type: 'cron' | 'webhook';
  cronExpression?: string;      // For cron triggers
  timezone?: string;            // For cron triggers
}

export interface InstantiationRequest {
  templateId: string;
  workflowName: string;
  repositoryId: string;
  agentId: string;
  config: Record<string, any>;
  trigger: TriggerConfig;
  notificationConfig?: NotificationConfig;
}

export interface WebhookConfig {
  webhookId: string;
  url: string;
  secret: string;
  events: string[];
}

export interface HealthStatus {
  healthy: boolean;
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  message?: string;
}

export interface ExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  duration?: number;
  result?: any;
  logs: ExecutionLog[];
  error?: ExecutionError;
  tokensUsed: number;
  mcpCallCount: number;
}

// ============================================================
// MCP CONNECTION TYPES
// ============================================================

export interface MCPConnection {
  name: string;
  serverUrl: string;
  capabilities: string[];
  authenticated: boolean;
  config?: Record<string, any>;
}

// ============================================================
// PAGINATION TYPES
// ============================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListTemplatesRequest {
  filters?: TemplateFilters;
  limit?: number;
  offset?: number;
}

export interface ListWorkflowsRequest {
  repositoryId?: string;
  status?: 'enabled' | 'disabled';
  templateId?: string;
  limit?: number;
  offset?: number;
}

export interface ListExecutionsRequest {
  workflowId: string;
  status?: ExecutionStatus;
  limit?: number;
  offset?: number;
}

// ============================================================
// RETRY CONFIGURATION
// ============================================================

export interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
}

// ============================================================
// RATE LIMITING TYPES
// ============================================================

export interface RateLimitConfig {
  maxExecutionsPerHour: number;
  maxExecutionsPerDay: number;
  maxConcurrentExecutions: number;
  maxExecutionDuration: number; // seconds
}

export interface UserLimitConfig {
  maxWorkflows: number;
  maxTemplateCreations: number; // per day
}

// ============================================================
// METRICS TYPES
// ============================================================

export interface TemplateUsageMetrics {
  byTemplate: Map<string, number>;
  byCategory: Map<string, number>;
  byUser: Map<string, number>;
}

export interface ExecutionMetrics {
  successRate: number;
  averageDuration: number;
  p95Duration: number;
  failureReasons: Map<string, number>;
}

export interface ResourceUsageMetrics {
  activeSandboxes: number;
  queueDepth: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface ApiMetrics {
  requestsPerSecond: number;
  errorRate: number;
  p95ResponseTime: number;
}

export interface SystemMetrics {
  templateUsage: TemplateUsageMetrics;
  executionMetrics: ExecutionMetrics;
  resourceUsage: ResourceUsageMetrics;
  apiMetrics: ApiMetrics;
}
