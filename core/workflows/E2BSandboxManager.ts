/**
 * E2B Sandbox Manager
 *
 * Manages E2B sandboxes for code execution.
 * Handles sandbox provisioning, code injection, and MCP connections.
 */

import { Sandbox } from '@e2b/code-interpreter';
import {
  ExecutionResult,
  ExecutionLog,
  ExecutionError,
  HealthStatus,
  MCPConnection,
  ExecutionStatus,
} from './types';

export class E2BSandboxManager {
  private sandboxPool: Map<string, Sandbox> = new Map();
  private activeSandboxes: Set<string> = new Set();
  private sandboxCreationTimes: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly MAX_POOL_SIZE = 100;
  private readonly SANDBOX_TIMEOUT_MS = 600000; // 10 minutes
  private readonly CLEANUP_INTERVAL_MS = 300000; // 5 minutes
  private readonly SANDBOX_MAX_AGE_MS = 3600000; // 1 hour

  constructor() {
    // Start automatic cleanup
    this.startAutomaticCleanup();
  }

  /**
   * Start automatic sandbox cleanup
   */
  private startAutomaticCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSandboxes(this.SANDBOX_MAX_AGE_MS).catch(error => {
        console.error('[E2BSandboxManager] Automatic cleanup failed:', error);
      });
    }, this.CLEANUP_INTERVAL_MS);

    console.log('[E2BSandboxManager] Automatic cleanup started');
  }

  /**
   * Stop automatic cleanup
   */
  stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[E2BSandboxManager] Automatic cleanup stopped');
    }
  }

  /**
   * Get or create sandbox for execution
   */
  async getSandbox(executionId: string): Promise<Sandbox> {
    console.log(`[E2BSandboxManager] Getting sandbox for execution: ${executionId}`);

    // Check if sandbox already exists for this execution
    if (this.sandboxPool.has(executionId)) {
      return this.sandboxPool.get(executionId)!;
    }

    // Create new sandbox
    const sandbox = await this.createSandbox();
    this.sandboxPool.set(executionId, sandbox);
    this.activeSandboxes.add(executionId);
    this.sandboxCreationTimes.set(executionId, Date.now());

    console.log(`[E2BSandboxManager] Created sandbox for execution: ${executionId}`);

    return sandbox;
  }

  /**
   * Create a new E2B sandbox
   */
  private async createSandbox(): Promise<Sandbox> {
    try {
      const sandbox = await Sandbox.create({
        apiKey: process.env.E2B_API_KEY,
        timeout: this.SANDBOX_TIMEOUT_MS,
      });

      return sandbox;
    } catch (error: any) {
      console.error('[E2BSandboxManager] Failed to create sandbox:', error);
      throw new Error(`Failed to create sandbox: ${error.message}`);
    }
  }

  /**
   * Execute template code in sandbox
   */
  async executeTemplate(
    executionId: string,
    code: string,
    config: Record<string, any>,
    mcpServers: string[],
    repositoryId: string
  ): Promise<ExecutionResult> {
    const logs: ExecutionLog[] = [];
    const startTime = Date.now();

    let status: ExecutionStatus = 'pending';
    let result: any = null;
    let error: ExecutionError | undefined;
    let tokensUsed = 0;
    let mcpCallCount = 0;

    try {
      status = 'running';

      // Get sandbox
      const sandbox = await this.getSandbox(executionId);

      // Build MCP connections
      const mcpConnections = await this.buildMCPConnections(mcpServers, repositoryId);

      // Inject environment variables
      const envVars = this.buildEnvVars(config);

      // Build wrapped code with MCP proxy
      const wrappedCode = this.wrapCode(code, envVars, mcpConnections);

      // Log execution start
      logs.push({
        timestamp: new Date(),
        level: 'info',
        message: '🚀 Starting template execution...',
      });

      // Execute code in sandbox
      const execution = await sandbox.runCode(wrappedCode);

      // Collect logs from stdout/stderr
      if (execution.logs) {
        for (const log of execution.logs) {
          logs.push({
            timestamp: new Date(),
            level: this.detectLogLevel(log),
            message: log,
          });
        }
      }

      // Get result
      if (execution.error) {
        throw new Error(execution.error.message);
      }

      result = execution.result;
      status = 'success';

      logs.push({
        timestamp: new Date(),
        level: 'info',
        message: '✅ Template execution completed successfully',
      });

    } catch (err: any) {
      status = 'failed';
      error = {
        message: err.message || 'Unknown error',
        stack: err.stack,
        code: err.code,
        isRetryable: this.isRetryableError(err),
      };

      logs.push({
        timestamp: new Date(),
        level: 'error',
        message: `❌ Template execution failed: ${err.message}`,
        metadata: { stack: err.stack },
      });
    }

    const duration = Date.now() - startTime;

    return {
      executionId,
      status,
      duration,
      result,
      logs,
      error,
      tokensUsed,
      mcpCallCount,
    };
  }

  /**
   * Build MCP connections
   */
  private async buildMCPConnections(
    mcpServers: string[],
    repositoryId: string
  ): Promise<MCPConnection[]> {
    const connections: MCPConnection[] = [];

    for (const serverName of mcpServers) {
      // In production, this would establish actual MCP connections
      // For now, create mock connections
      connections.push({
        name: serverName,
        serverUrl: `mcp://${serverName}`,
        capabilities: this.getMCPCapabilities(serverName),
        authenticated: true,
        config: {
          repositoryId,
        },
      });
    }

    return connections;
  }

  /**
   * Get MCP server capabilities
   */
  private getMCPCapabilities(serverName: string): string[] {
    const capabilities: Record<string, string[]> = {
      github: ['listRepositories', 'listIssues', 'createIssue', 'addLabels', 'createComment'],
      slack: ['sendMessage', 'listChannels', 'createChannel'],
      filesystem: ['readFile', 'writeFile', 'listFiles', 'deleteFile'],
      sentry: ['listIssues', 'getIssue', 'updateIssue'],
      snyk: ['scanProject', 'listVulnerabilities'],
    };

    return capabilities[serverName] || [];
  }

  /**
   * Build environment variables string
   */
  private buildEnvVars(config: Record<string, any>): string {
    return Object.entries(config)
      .map(([key, value]) => {
        const strValue = typeof value === 'string' ? value : JSON.stringify(value);
        return `process.env.${key} = '${strValue}';`;
      })
      .join('\n');
  }

  /**
   * Wrap template code with MCP proxy and environment setup
   */
  private wrapCode(
    code: string,
    envVars: string,
    mcpConnections: MCPConnection[]
  ): string {
    const mcpProxy = this.generateMCPProxy(mcpConnections);

    return `
// ============================================================
// MCP PROXY SETUP
// ============================================================

${mcpProxy}

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

${envVars}

// ============================================================
// TEMPLATE CODE
// ============================================================

(async () => {
  try {
    ${code}
  } catch (error) {
    console.error('Template execution failed:', error);
    throw error;
  }
})();
`;
  }

  /**
   * Generate MCP proxy code
   */
  private generateMCPProxy(mcpConnections: MCPConnection[]): string {
    const proxies = mcpConnections.map(server => {
      return `
const ${server.name} = new Proxy({}, {
  get(target, method) {
    return async (...args) => {
      // Call MCP server via IPC
      console.log(\`[MCP] Calling ${server.name}.\${String(method)}(...)\`);

      // In production, this would call the actual MCP server
      // For now, return mock data
      return { success: true, data: [] };
    };
  }
});
`;
    });

    return proxies.join('\n');
  }

  /**
   * Detect log level from message
   */
  private detectLogLevel(message: string): 'debug' | 'info' | 'warn' | 'error' {
    const lower = message.toLowerCase();

    if (lower.includes('error') || lower.includes('❌') || lower.includes('failed')) {
      return 'error';
    }

    if (lower.includes('warn') || lower.includes('⚠️')) {
      return 'warn';
    }

    if (lower.includes('debug')) {
      return 'debug';
    }

    return 'info';
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = ['RATE_LIMIT', 'TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'];
    return retryableCodes.includes(error.code);
  }

  /**
   * Destroy sandbox
   */
  async destroySandbox(executionId: string): Promise<void> {
    const sandbox = this.sandboxPool.get(executionId);

    if (sandbox) {
      try {
        await sandbox.close();
      } catch (error: any) {
        console.error(`[E2BSandboxManager] Failed to close sandbox ${executionId}:`, error);
      }

      this.sandboxPool.delete(executionId);
      this.activeSandboxes.delete(executionId);
      this.sandboxCreationTimes.delete(executionId);

      console.log(`[E2BSandboxManager] Destroyed sandbox: ${executionId}`);
    }
  }

  /**
   * Health check for sandbox
   */
  async healthCheck(executionId: string): Promise<HealthStatus> {
    const sandbox = this.sandboxPool.get(executionId);

    if (!sandbox) {
      return {
        healthy: false,
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        message: 'Sandbox not found',
      };
    }

    try {
      // In production, query actual sandbox metrics
      return {
        healthy: true,
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
      };
    } catch (error: any) {
      return {
        healthy: false,
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        message: error.message,
      };
    }
  }

  /**
   * Clean up old sandboxes based on age and pool size
   */
  async cleanupOldSandboxes(maxAgeMs: number = 3600000): Promise<void> {
    console.log('[E2BSandboxManager] Cleaning up old sandboxes...');

    const now = Date.now();
    let cleaned = 0;
    const sandboxesToClean: string[] = [];

    // Find sandboxes that are too old or exceed pool size
    for (const executionId of this.activeSandboxes) {
      const creationTime = this.sandboxCreationTimes.get(executionId);

      if (creationTime) {
        const age = now - creationTime;
        if (age > maxAgeMs) {
          sandboxesToClean.push(executionId);
        }
      }
    }

    // Also clean if pool size exceeded
    if (this.sandboxPool.size > this.MAX_POOL_SIZE) {
      // Get oldest sandboxes first
      const oldestFirst = Array.from(this.activeSandboxes)
        .filter(id => !sandboxesToClean.includes(id))
        .sort((a, b) => {
          const timeA = this.sandboxCreationTimes.get(a) || 0;
          const timeB = this.sandboxCreationTimes.get(b) || 0;
          return timeA - timeB;
        });

      const excess = this.sandboxPool.size - this.MAX_POOL_SIZE;
      sandboxesToClean.push(...oldestFirst.slice(0, excess));
    }

    // Clean up identified sandboxes
    for (const executionId of sandboxesToClean) {
      await this.destroySandbox(executionId);
      cleaned++;
    }

    if (cleaned > 0) {
      console.log(`[E2BSandboxManager] Cleaned up ${cleaned} sandboxes`);
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    totalSandboxes: number;
    activeSandboxes: number;
    poolSize: number;
  } {
    return {
      totalSandboxes: this.sandboxPool.size,
      activeSandboxes: this.activeSandboxes.size,
      poolSize: this.MAX_POOL_SIZE,
    };
  }
}
