# Technical Design Document: ParallelDev Local MVP

**Version:** 1.0

**Author:** Technical Architecture Team

**Date:** November 15, 2025

**Status:** Draft

---

## Executive Summary

ParallelDev is a local-first AI code editor that enables parallel multi-agent development with automatic conflict detection and preview merging. Built on VS Code and Continue.dev, it integrates Spec Kit for task orchestration and uses git worktrees for isolated parallel execution.

**Core Innovation:** Execute multiple implementation strategies simultaneously, automatically detect merge conflicts, and preview combinations before committing to main branch.

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code Fork                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │          Continue.dev Fork (Extension)           │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │       Code Execution Engine (E2B)         │  │  │
│  │  │  - MCP tools as TypeScript APIs          │  │  │
│  │  │  - Sandboxed execution                   │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │                                                   │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │       LSP Integration (Crush Style)       │  │  │
│  │  │  - stdio pipes to LSP servers            │  │  │
│  │  │  - JSON-RPC communication                │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         ParallelDev Extension (New)              │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │   Spec Kit Parser & Orchestrator          │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │   Multi-Agent Worktree Manager            │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │   Conflict Detection Matrix               │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │   Preview Merge Generator                 │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

```

### 1.2 Technology Stack

| Component | Technology | Justification |
| --- | --- | --- |
| **Editor Base** | VS Code Fork | Proven editor infrastructure, LSP support built-in |
| **AI Integration** | Continue.dev Fork | Apache 2.0 license, extensible architecture |
| **Code Execution** | E2B Sandbox | Fast (150ms spin-up), isolated, supports TypeScript |
| **LSP Communication** | stdio + JSON-RPC | Standard protocol, works with any LSP server |
| **Task Orchestration** | Spec Kit | GitHub-backed, designed for AI workflows |
| **Git Management** | Native git + worktrees | No dependencies, built into git 2.5+ |
| **UI Framework** | React + Webviews | Native VS Code integration |

---

## 2. Component Design

### 2.1 VS Code Fork Strategy

**Decision: Minimal Fork Approach**

Instead of heavily modifying VS Code, we fork only to:

1. Pre-bundle Continue.dev extension
2. Pre-bundle ParallelDev extension
3. Brand as "ParallelDev"

**Fork Maintenance:**

```bash
# Setup upstream tracking
git remote add upstream <https://github.com/microsoft/vscode.git>

# Monthly sync (automated via GitHub Actions)
git fetch upstream
git merge upstream/main
git push origin main

```

**Modified Files:**

- `product.json` - Branding
- `package.json` - Dependencies
- `extensions/` - Pre-bundled extensions
- `build/` - Custom build scripts

**Unchanged:** Core editor, LSP client, extension API

**Rationale:** Minimize maintenance burden. Most functionality lives in extensions, not core.

---

### 2.2 Continue.dev Fork & Code Mode

### 2.2.1 Code Mode Architecture

**Goal:** Execute MCP tools via code instead of JSON tool calls.

**Implementation Path:**

```tsx
// extensions/continue/core/execution/CodeExecutionProvider.ts

export interface CodeExecutionProvider {
  executeCode(code: string, context: ExecutionContext): Promise<ExecutionResult>;
  getMCPAPIs(): MCPAPIDefinition[];
}

export class E2BCodeExecutionProvider implements CodeExecutionProvider {
  private sandbox: Sandbox | null = null;
  private mcpServers: Map<string, MCPServer> = new Map();

  async initialize(config: CodeExecutionConfig): Promise<void> {
    // 1. Spin up E2B sandbox
    this.sandbox = await Sandbox.create({
      template: 'base',
      timeoutMs: 300000
    });

    // 2. Connect to MCP servers from config
    for (const serverConfig of config.mcpServers) {
      const server = await this.connectMCPServer(serverConfig);
      this.mcpServers.set(serverConfig.name, server);
    }

    // 3. Generate TypeScript API wrappers
    await this.generateMCPWrappers();
  }

  private async generateMCPWrappers(): Promise<void> {
    for (const [name, server] of this.mcpServers) {
      const tools = await server.listTools();
      const apiCode = this.generateAPIWrapper(name, tools);

      // Write to sandbox filesystem
      await this.sandbox!.files.write(
        `/mcp/${name}.ts`,
        apiCode
      );
    }

    // Create index.ts that exports all APIs
    const indexCode = Array.from(this.mcpServers.keys())
      .map(name => `export * as ${name} from './${name}';`)
      .join('\\n');

    await this.sandbox!.files.write('/mcp/index.ts', indexCode);
  }

  private generateAPIWrapper(
    serverName: string,
    tools: Tool[]
  ): string {
    const methods = tools.map(tool => `
      async ${tool.name}(${this.generateParams(tool)}): Promise<any> {
        const result = await globalThis.__mcp_invoke(
          '${serverName}',
          '${tool.name}',
          arguments[0]
        );
        return result;
      }
    `).join('\\n');

    return `
      // Auto-generated API for ${serverName}
      export const ${serverName} = {
        ${methods}
      };
    `;
  }

  async executeCode(
    code: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    // Inject MCP imports
    const fullCode = `
      import * as mcp from '/mcp/index';

      async function main() {
        ${code}
      }

      main().then(result => {
        console.log(JSON.stringify(result, null, 2));
      }).catch(err => {
        console.error(err);
        process.exit(1);
      });
    `;

    // Execute in sandbox
    const execution = await this.sandbox!.runCode(fullCode);

    // Handle MCP invocations
    for (const invocation of execution.mcpInvocations) {
      const result = await this.handleMCPInvocation(invocation);
      // Send result back to sandbox
    }

    return {
      stdout: execution.logs.stdout.join('\\n'),
      stderr: execution.logs.stderr.join('\\n'),
      exitCode: execution.error ? 1 : 0,
      error: execution.error
    };
  }

  private async handleMCPInvocation(
    invocation: MCPInvocation
  ): Promise<any> {
    const server = this.mcpServers.get(invocation.serverName);
    if (!server) {
      throw new Error(`Unknown MCP server: ${invocation.serverName}`);
    }

    return await server.callTool(
      invocation.toolName,
      invocation.params
    );
  }
}

```

**Configuration:**

```yaml
# ~/.continue/config.yaml
experimental:
  codeExecution:
    enabled: true
    provider: e2b
    apiKey: ${E2B_API_KEY}

    mcpServers:
      - name: filesystem
        command: npx
        args: [-y, "@modelcontextprotocol/server-filesystem"]
        env:
          ALLOWED_DIRECTORIES: "${WORKSPACE_ROOT}"

      - name: github
        command: npx
        args: [-y, "@modelcontextprotocol/server-github"]
        env:
          GITHUB_TOKEN: ${GITHUB_TOKEN}

```

**Integration with Continue.dev Chat:**

```tsx
// Modified Continue.dev agent loop
async function generateResponse(
  prompt: string,
  context: Context
): Promise<string> {

  // Check if code execution is enabled
  if (config.experimental?.codeExecution?.enabled) {
    const systemPrompt = `
You have access to these MCP APIs as TypeScript modules:
${codeExecutionProvider.getMCPAPIs().map(api => api.docs).join('\\n')}

Write TypeScript code to accomplish the task.
Import APIs like: import { filesystem, github } from 'mcp';
Return results via returning a value or console.log().
    `;

    const codeResponse = await llm.complete(systemPrompt, prompt);

    // Execute the generated code
    const result = await codeExecutionProvider.executeCode(
      codeResponse.code,
      { workspaceRoot: vscode.workspace.rootPath }
    );

    if (result.exitCode !== 0) {
      // Retry with error context
      return await generateResponse(
        `Previous code had error: ${result.error}. Fix and try again.`,
        context
      );
    }

    return result.stdout;
  }

  // Fallback to traditional tool calling
  return await traditionalAgentLoop(prompt, context);
}

```

---

### 2.3 LSP Integration (Crush Style)

**Goal:** Query LSP servers for type information, diagnostics, and definitions without VS Code's extension API limitations.

### 2.3.1 LSP Client Implementation

```tsx
// extensions/paralleldev/src/lsp/LSPClient.ts

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface LSPMessage {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: any;
  result?: any;
  error?: any;
}

export class LSPClient extends EventEmitter {
  private process: ChildProcess;
  private messageBuffer: string = '';
  private pendingRequests: Map<number, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }> = new Map();
  private messageId: number = 0;

  constructor(
    private command: string,
    private args: string[],
    private workspaceRoot: string
  ) {
    super();
  }

  async start(): Promise<void> {
    // Spawn LSP server process
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle stdout
    this.process.stdout.on('data', (data) => {
      this.handleData(data.toString());
    });

    // Handle stderr
    this.process.stderr.on('data', (data) => {
      console.error(`LSP Error: ${data.toString()}`);
    });

    // Initialize LSP connection
    await this.sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${this.workspaceRoot}`,
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['markdown', 'plaintext'] },
          definition: { linkSupport: true },
          references: {},
          documentSymbol: {},
          completion: {}
        }
      }
    });

    // Send initialized notification
    this.sendNotification('initialized', {});
  }

  private handleData(data: string): void {
    this.messageBuffer += data;

    // Parse complete messages
    while (true) {
      const headerEnd = this.messageBuffer.indexOf('\\r\\n\\r\\n');
      if (headerEnd === -1) break;

      const header = this.messageBuffer.substring(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length: (\\d+)/);

      if (!contentLengthMatch) break;

      const contentLength = parseInt(contentLengthMatch[1]);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (this.messageBuffer.length < messageEnd) break;

      const messageContent = this.messageBuffer.substring(
        messageStart,
        messageEnd
      );

      this.messageBuffer = this.messageBuffer.substring(messageEnd);

      try {
        const message: LSPMessage = JSON.parse(messageContent);
        this.handleMessage(message);
      } catch (err) {
        console.error('Failed to parse LSP message:', err);
      }
    }
  }

  private handleMessage(message: LSPMessage): void {
    if (message.id !== undefined) {
      // Response to our request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(message.error);
        } else {
          pending.resolve(message.result);
        }
      }
    } else {
      // Notification from server
      this.emit(message.method, message.params);
    }
  }

  private async sendRequest(
    method: string,
    params: any
  ): Promise<any> {
    const id = this.messageId++;

    const message: LSPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
    });

    this.sendMessage(message);

    return promise;
  }

  private sendNotification(method: string, params: any): void {
    const message: LSPMessage = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.sendMessage(message);
  }

  private sendMessage(message: LSPMessage): void {
    const content = JSON.stringify(message);
    const header = `Content-Length: ${content.length}\\r\\n\\r\\n`;

    this.process.stdin.write(header + content);
  }

  // Public API methods

  async didOpen(uri: string, languageId: string, text: string): Promise<void> {
    this.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId, version: 1, text }
    });
  }

  async didChange(uri: string, text: string, version: number): Promise<void> {
    this.sendNotification('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }]
    });
  }

  async hover(
    uri: string,
    line: number,
    character: number
  ): Promise<any> {
    return await this.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  async definition(
    uri: string,
    line: number,
    character: number
  ): Promise<any> {
    return await this.sendRequest('textDocument/definition', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  async references(
    uri: string,
    line: number,
    character: number
  ): Promise<any> {
    return await this.sendRequest('textDocument/references', {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration: true }
    });
  }

  shutdown(): void {
    this.sendRequest('shutdown', {});
    this.sendNotification('exit', {});
    this.process.kill();
  }
}

```

### 2.3.2 LSP Manager

```tsx
// extensions/paralleldev/src/lsp/LSPManager.ts

export class LSPManager {
  private clients: Map<string, LSPClient> = new Map();
  private config: LSPConfig;

  constructor(workspaceRoot: string) {
    this.loadConfig();
  }

  private loadConfig(): void {
    // Load from .paralleldev/lsp.json
    const configPath = path.join(
      vscode.workspace.rootPath,
      '.paralleldev',
      'lsp.json'
    );

    if (fs.existsSync(configPath)) {
      this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } else {
      // Default config
      this.config = {
        typescript: {
          command: 'typescript-language-server',
          args: ['--stdio']
        },
        python: {
          command: 'pylsp',
          args: []
        },
        go: {
          command: 'gopls',
          args: []
        }
      };
    }
  }

  async getClient(languageId: string): Promise<LSPClient> {
    if (!this.clients.has(languageId)) {
      const config = this.config[languageId];
      if (!config) {
        throw new Error(`No LSP config for ${languageId}`);
      }

      const client = new LSPClient(
        config.command,
        config.args,
        vscode.workspace.rootPath
      );

      await client.start();

      // Listen for diagnostics
      client.on('textDocument/publishDiagnostics', (params) => {
        this.handleDiagnostics(params);
      });

      this.clients.set(languageId, client);
    }

    return this.clients.get(languageId)!;
  }

  private handleDiagnostics(params: any): void {
    // Store diagnostics for later use by agents
    const uri = params.uri;
    const diagnostics = params.diagnostics;

    // Emit event for UI
    vscode.commands.executeCommand(
      'paralleldev.updateDiagnostics',
      uri,
      diagnostics
    );
  }

  async queryContext(
    filePath: string,
    line: number,
    character: number
  ): Promise<LSPContext> {
    const document = await vscode.workspace.openTextDocument(filePath);
    const languageId = document.languageId;
    const client = await this.getClient(languageId);

    const uri = `file://${filePath}`;

    // Open document in LSP
    await client.didOpen(uri, languageId, document.getText());

    // Query all context
    const [hover, definition, references] = await Promise.all([
      client.hover(uri, line, character),
      client.definition(uri, line, character),
      client.references(uri, line, character)
    ]);

    return {
      hover: hover?.contents,
      definition,
      references,
      diagnostics: [] // From publishDiagnostics
    };
  }

  dispose(): void {
    for (const client of this.clients.values()) {
      client.shutdown();
    }
    this.clients.clear();
  }
}

```

---

### 2.4 Spec Kit Integration

### 2.4.1 Spec Kit Parser

```tsx
// extensions/paralleldev/src/speckit/SpecKitParser.ts

export interface SpecKitTask {
  id: string;
  title: string;
  description: string;
  phase: string;
  parallel: boolean;
  dependencies: string[];
  files: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  estimatedComplexity: number; // 1-5
}

export interface SpecKitPlan {
  spec: string;
  plan: string;
  phases: Phase[];
  tasks: SpecKitTask[];
  parallelGroups: ParallelGroup[];
}

export class SpecKitParser {
  async parsePlan(workspaceRoot: string): Promise<SpecKitPlan> {
    const specPath = path.join(workspaceRoot, '.specify', 'spec.md');
    const planPath = path.join(workspaceRoot, '.specify', 'plan.md');
    const tasksPath = path.join(workspaceRoot, '.specify', 'tasks.md');

    const spec = fs.readFileSync(specPath, 'utf-8');
    const plan = fs.readFileSync(planPath, 'utf-8');
    const tasksContent = fs.readFileSync(tasksPath, 'utf-8');

    const tasks = this.parseTasks(tasksContent);
    const phases = this.extractPhases(plan);
    const parallelGroups = this.identifyParallelGroups(tasks);

    return { spec, plan, phases, tasks, parallelGroups };
  }

  private parseTasks(content: string): SpecKitTask[] {
    const tasks: SpecKitTask[] = [];

    // Parse markdown checkboxes
    const lines = content.split('\\n');
    let currentPhase = '';

    for (const line of lines) {
      // Phase headers
      if (line.startsWith('## ')) {
        currentPhase = line.replace('## ', '').trim();
        continue;
      }

      // Task items
      const taskMatch = line.match(/^- \\[( |x)\\] (.+?)(?:\\[P\\])?$/);
      if (taskMatch) {
        const [_, status, description] = taskMatch;
        const isParallel = line.includes('[P]');

        const task: SpecKitTask = {
          id: this.generateTaskId(description),
          title: description.trim(),
          description: description.trim(),
          phase: currentPhase,
          parallel: isParallel,
          dependencies: this.extractDependencies(description),
          files: this.extractFiles(description),
          status: status === 'x' ? 'completed' : 'pending',
          estimatedComplexity: this.estimateComplexity(description)
        };

        tasks.push(task);
      }
    }

    return tasks;
  }

  private extractDependencies(description: string): string[] {
    // Look for "depends on", "requires", "after" patterns
    const deps: string[] = [];
    const patterns = [
      /depends on (.+?)(?:\\.|,|$)/gi,
      /requires (.+?)(?:\\.|,|$)/gi,
      /after (.+?)(?:\\.|,|$)/gi
    ];

    for (const pattern of patterns) {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        deps.push(this.generateTaskId(match[1]));
      }
    }

    return deps;
  }

  private extractFiles(description: string): string[] {
    // Extract file paths mentioned in description
    const filePattern = /`([^`]+\\.(ts|js|py|go|rs|java))`/g;
    const matches = description.matchAll(filePattern);
    return Array.from(matches).map(m => m[1]);
  }

  private estimateComplexity(description: string): number {
    // Simple heuristic based on keywords
    let complexity = 1;

    const indicators = {
      'refactor': 3,
      'migrate': 4,
      'rewrite': 5,
      'optimize': 3,
      'implement': 2,
      'add': 1,
      'update': 1,
      'fix': 1
    };

    for (const [keyword, score] of Object.entries(indicators)) {
      if (description.toLowerCase().includes(keyword)) {
        complexity = Math.max(complexity, score);
      }
    }

    return complexity;
  }

  private identifyParallelGroups(tasks: SpecKitTask[]): ParallelGroup[] {
    const groups: ParallelGroup[] = [];
    const tasksByPhase = this.groupByPhase(tasks);

    for (const [phase, phaseTasks] of Object.entries(tasksByPhase)) {
      let currentGroup: SpecKitTask[] = [];

      for (const task of phaseTasks) {
        if (task.parallel) {
          currentGroup.push(task);
        } else {
          // Flush current parallel group
          if (currentGroup.length > 0) {
            groups.push({
              id: `${phase}-parallel-${groups.length}`,
              phase,
              tasks: currentGroup,
              canExecuteInParallel: true
            });
            currentGroup = [];
          }

          // Sequential task as its own group
          groups.push({
            id: `${phase}-sequential-${groups.length}`,
            phase,
            tasks: [task],
            canExecuteInParallel: false
          });
        }
      }

      // Flush remaining parallel tasks
      if (currentGroup.length > 0) {
        groups.push({
          id: `${phase}-parallel-${groups.length}`,
          phase,
          tasks: currentGroup,
          canExecuteInParallel: true
        });
      }
    }

    return groups;
  }

  private groupByPhase(tasks: SpecKitTask[]): Record<string, SpecKitTask[]> {
    const grouped: Record<string, SpecKitTask[]> = {};

    for (const task of tasks) {
      if (!grouped[task.phase]) {
        grouped[task.phase] = [];
      }
      grouped[task.phase].push(task);
    }

    return grouped;
  }

  private generateTaskId(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 50);
  }
}

```

---

### 2.5 Multi-Agent Worktree Orchestrator

### 2.5.1 Worktree Manager

```tsx
// extensions/paralleldev/src/worktree/WorktreeManager.ts

export interface Worktree {
  id: string;
  path: string;
  branch: string;
  taskId: string;
  status: 'active' | 'merged' | 'abandoned';
  createdAt: number;
}

export class WorktreeManager {
  private worktrees: Map<string, Worktree> = new Map();
  private baseRepo: string;

  constructor(workspaceRoot: string) {
    this.baseRepo = workspaceRoot;
  }

  async createParallelWorktrees(
    tasks: SpecKitTask[]
  ): Promise<Worktree[]> {
    const worktrees: Worktree[] = [];

    for (const task of tasks) {
      const worktree = await this.createWorktree(task);
      worktrees.push(worktree);
    }

    return worktrees;
  }

  private async createWorktree(task: SpecKitTask): Promise<Worktree> {
    const id = `task-${task.id}`;
    const branch = `agent/${id}-${Date.now()}`;
    const worktreePath = path.join(
      this.baseRepo,
      '..',
      'worktrees',
      id
    );

    // Create worktree
    await execAsync(`
      cd ${this.baseRepo}
      git worktree add ${worktreePath} -b ${branch}
    `);

    const worktree: Worktree = {
      id,
      path: worktreePath,
      branch,
      taskId: task.id,
      status: 'active',
      createdAt: Date.now()
    };

    this.worktrees.set(id, worktree);

    return worktree;
  }

  async removeWorktree(id: string): Promise<void> {
    const worktree = this.worktrees.get(id);
    if (!worktree) return;

    await execAsync(`
      cd ${this.baseRepo}
      git worktree remove ${worktree.path} --force
    `);

    this.worktrees.delete(id);
  }

  async listWorktrees(): Promise<Worktree[]> {
    return Array.from(this.worktrees.values());
  }

  async getWorktree(id: string): Promise<Worktree | undefined> {
    return this.worktrees.get(id);
  }
}

```

### 2.5.2 Agent Orchestrator

```tsx
// extensions/paralleldev/src/orchestrator/AgentOrchestrator.ts

export class AgentOrchestrator {
  private worktreeManager: WorktreeManager;
  private lspManager: LSPManager;
  private continueAPI: ContinueAPI;

  constructor(
    workspaceRoot: string,
    continueAPI: ContinueAPI
  ) {
    this.worktreeManager = new WorktreeManager(workspaceRoot);
    this.lspManager = new LSPManager(workspaceRoot);
    this.continueAPI = continueAPI;
  }

  async executeParallelTasks(
    tasks: SpecKitTask[]
  ): Promise<TaskResult[]> {
    // Create worktree for each task
    const worktrees = await this.worktreeManager.createParallelWorktrees(tasks);

    // Execute agents in parallel
    const resultPromises = tasks.map((task, idx) => {
      return this.executeTaskInWorktree(task, worktrees[idx]);
    });

    const results = await Promise.all(resultPromises);

    return results;
  }

  private async executeTaskInWorktree(
    task: SpecKitTask,
    worktree: Worktree
  ): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Build context for agent
      const context = await this.buildTaskContext(task, worktree);

      // Execute agent via Continue.dev
      const agentResult = await this.continueAPI.executeAgent({
        prompt: this.buildPrompt(task, context),
        workingDirectory: worktree.path,
        codeExecutionEnabled: true
      });

      // Get LSP diagnostics
      const diagnostics = await this.getLSPDiagnostics(worktree.path);

      // Commit changes
      await this.commitChanges(worktree, task);

      return {
        taskId: task.id,
        worktreeId: worktree.id,
        success: diagnostics.errors.length === 0,
        filesChanged: agentResult.filesChanged,
        diagnostics,
        duration: Date.now() - startTime,
        agentOutput: agentResult.output
      };

    } catch (error) {
      return {
        taskId: task.id,
        worktreeId: worktree.id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private async buildTaskContext(
    task: SpecKitTask,
    worktree: Worktree
  ): Promise<TaskContext> {
    // Get relevant files
    const relevantFiles = await this.findRelevantFiles(
      task.files,
      worktree.path
    );

    // Get LSP context for files
    const lspContext: Record<string, LSPContext> = {};
    for (const file of relevantFiles) {
      lspContext[file] = await this.lspManager.queryContext(
        path.join(worktree.path, file),
        0,
        0
      );
    }

    return {
      files: relevantFiles,
      lspContext,
      dependencies: task.dependencies,
      phase: task.phase
    };
  }

  private buildPrompt(
    task: SpecKitTask,
    context: TaskContext
  ): string {
    return `
# Task: ${task.title}

## Description
${task.description}

## Context
Phase: ${task.phase}
Complexity: ${task.estimatedComplexity}/5
Dependencies: ${task.dependencies.join(', ') || 'None'}

## Relevant Files
${context.files.map(f => `- ${f}`).join('\\n')}

## LSP Context
${Object.entries(context.lspContext).map(([file, ctx]) => `
### ${file}
${ctx.diagnostics.length > 0 ? 'Existing issues:\\n' + ctx.diagnostics.map(d => `- ${d.message}`).join('\\n') : 'No issues'}
`).join('\\n')}

## Instructions
1. Implement the task described above
2. Follow existing code patterns
3. Ensure all TypeScript types are correct
4. Write tests if applicable
5. Commit your changes with a descriptive message

Use code execution mode with MCP tools for file operations.
    `.trim();
  }

  private async getLSPDiagnostics(
    worktreePath: string
  ): Promise<DiagnosticsSummary> {
    // Get all TypeScript/JavaScript files
    const files = await glob('**/*.{ts,tsx,js,jsx}', {
      cwd: worktreePath,
      ignore: ['node_modules/**', 'dist/**', 'build/**']
    });

    const allDiagnostics: any[] = [];

    for (const file of files) {
      const filePath = path.join(worktreePath, file);
      const document = await vscode.workspace.openTextDocument(filePath);
      const client = await this.lspManager.getClient(document.languageId);

      // didOpen triggers diagnostics
      await client.didOpen(
        `file://${filePath}`,
        document.languageId,
        document.getText()
      );

      // Wait for diagnostics (emitted via event)
      // Store in memory, retrieve here
    }

    return {
      errors: allDiagnostics.filter(d => d.severity === 1),
      warnings: allDiagnostics.filter(d => d.severity === 2),
      total: allDiagnostics.length
    };
  }

  private async commitChanges(
    worktree: Worktree,
    task: SpecKitTask
  ): Promise<void> {
    await execAsync(`
      cd ${worktree.path}
      git add .
      git commit -m "Complete: ${task.title}" -m "${task.description}"
    `);
  }
}

```

---

### 2.6 Conflict Detection & Preview System

### 2.6.1 Conflict Detector

```tsx
// extensions/paralleldev/src/conflict/ConflictDetector.ts

export interface ConflictResult {
  worktreeA: string;
  worktreeB: string;
  canMerge: boolean;
  conflictFiles: ConflictFile[];
  conflictSeverity: 'none' | 'minor' | 'major';
}

export interface ConflictFile {
  path: string;
  conflicts: ConflictRegion[];
}

export interface ConflictRegion {
  startLine: number;
  endLine: number;
  ourContent: string;
  theirContent: string;
}

export class ConflictDetector {
  async buildConflictMatrix(
    worktrees: Worktree[]
  ): Promise<ConflictMatrix> {
    const matrix: ConflictMatrix = {
      worktrees: worktrees.map(w => w.id),
      conflicts: {}
    };

    // Check all pairwise combinations
    for (let i = 0; i < worktrees.length; i++) {
      for (let j = i + 1; j < worktrees.length; j++) {
        const key = `${worktrees[i].id}:${worktrees[j].id}`;
        matrix.conflicts[key] = await this.checkConflict(
          worktrees[i],
          worktrees[j]
        );
      }
    }

    return matrix;
  }

  private async checkConflict(
    a: Worktree,
    b: Worktree
  ): Promise<ConflictResult> {
    // Use git merge-tree to simulate merge
    const result = await execAsync(`
      cd ${a.path}
      git merge-tree \\
        $(git merge-base ${a.branch} ${b.branch}) \\
        ${a.branch} \\
        ${b.branch}
    `);

    const hasConflicts = result.stdout.includes('<<<<<<<');

    if (!hasConflicts) {
      return {
        worktreeA: a.id,
        worktreeB: b.id,
        canMerge: true,
        conflictFiles: [],
        conflictSeverity: 'none'
      };
    }

    // Parse conflict markers
    const conflictFiles = this.parseConflicts(result.stdout);
    const severity = this.calculateSeverity(conflictFiles);

    return {
      worktreeA: a.id,
      worktreeB: b.id,
      canMerge: false,
      conflictFiles,
      conflictSeverity: severity
    };
  }

  private parseConflicts(mergeOutput: string): ConflictFile[] {
    const files: Map<string, ConflictRegion[]> = new Map();

    // Parse merge-tree output
    // Format: <<<<<<<, =======, >>>>>>>
    const lines = mergeOutput.split('\\n');
    let currentFile: string | null = null;
    let inConflict = false;
    let currentConflict: Partial<ConflictRegion> = {};
    let lineNum = 0;

    for (const line of lines) {
      if (line.startsWith('@@@ ')) {
        // File marker
        currentFile = line.split(' ')[3];
        if (!files.has(currentFile)) {
          files.set(currentFile, []);
        }
        continue;
      }

      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        currentConflict = { startLine: lineNum, ourContent: '' };
      } else if (line.startsWith('=======')) {
        currentConflict.theirContent = '';
      } else if (line.startsWith('>>>>>>>')) {
        currentConflict.endLine = lineNum;
        if (currentFile) {
          files.get(currentFile)!.push(currentConflict as ConflictRegion);
        }
        inConflict = false;
        currentConflict = {};
      } else if (inConflict) {
        if (currentConflict.theirContent !== undefined) {
          currentConflict.theirContent += line + '\\n';
        } else {
          currentConflict.ourContent += line + '\\n';
        }
      }

      lineNum++;
    }

    return Array.from(files.entries()).map(([path, conflicts]) => ({
      path,
      conflicts
    }));
  }

  private calculateSeverity(
    conflictFiles: ConflictFile[]
  ): 'minor' | 'major' {
    const totalConflicts = conflictFiles.reduce(
      (sum, file) => sum + file.conflicts.length,
      0
    );

    const totalLines = conflictFiles.reduce(
      (sum, file) => sum + file.conflicts.reduce(
        (s, c) => s + (c.endLine - c.startLine),
        0
      ),
      0
    );

    // Heuristic: minor if < 3 conflicts and < 50 lines
    if (totalConflicts < 3 && totalLines < 50) {
      return 'minor';
    }

    return 'major';
  }

  async resolveConflictsWithAI(
    conflictResult: ConflictResult,
    worktreeA: Worktree,
    worktreeB: Worktree
  ): Promise<Resolution> {
    // Build prompt for LLM
    const prompt = this.buildConflictPrompt(conflictResult);

    // Use Continue.dev to resolve
    const resolution = await this.continueAPI.executeAgent({
      prompt,
      workingDirectory: worktreeA.path,
      codeExecutionEnabled: true
    });

    return {
      success: resolution.success,
      resolvedFiles: resolution.filesChanged,
      strategy: resolution.strategy // 'keep-ours', 'keep-theirs', 'merge-both'
    };
  }

  private buildConflictPrompt(result: ConflictResult): string {
    return `
# Merge Conflict Resolution

Worktrees ${result.worktreeA} and ${result.worktreeB} have conflicts.

## Conflicts

${result.conflictFiles.map(file => `
### ${file.path}

${file.conflicts.map((c, idx) => `
**Conflict ${idx + 1}** (lines ${c.startLine}-${c.endLine})

Our version:
\\`\\`\\`
${c.ourContent}
\\`\\`\\`

Their version:
\\`\\`\\`
${c.theirContent}
\\`\\`\\`
`).join('\\n')}
`).join('\\n')}

## Task

Resolve these conflicts by:
1. Analyzing both versions
2. Choosing the best approach (keep one, merge both, or rewrite)
3. Writing the resolved code to the files

Return your resolution strategy and the resolved code.
    `.trim();
  }
}

```

### 2.6.2 Preview Merge Generator

```tsx
// extensions/paralleldev/src/preview/PreviewGenerator.ts

export class PreviewGenerator {
  private worktreeManager: WorktreeManager;

  async createPreviewMerge(
    selectedWorktrees: Worktree[],
    baseRepo: string
  ): Promise<PreviewWorktree> {
    // Create new preview worktree
    const previewId = `preview-${Date.now()}`;
    const previewBranch = `preview/${previewId}`;
    const previewPath = path.join(
      baseRepo,
      '..',
      'worktrees',
      previewId
    );

    await execAsync(`
      cd ${baseRepo}
      git worktree add ${previewPath} -b ${previewBranch}
    `);

    // Merge selected worktrees sequentially
    const mergeResults: MergeResult[] = [];

    for (const worktree of selectedWorktrees) {
      try {
        await execAsync(`
          cd ${previewPath}
          git merge ${worktree.branch} --no-ff --no-edit
        `);

        mergeResults.push({
          worktreeId: worktree.id,
          success: true,
          conflicts: []
        });

      } catch (error) {
        // Merge conflict occurred
        const conflicts = await this.getConflicts(previewPath);

        // Try AI resolution
        const resolution = await this.resolveConflictsWithAI(
          previewPath,
          conflicts
        );

        if (resolution.success) {
          // Apply resolution and commit
          await execAsync(`
            cd ${previewPath}
            git add .
            git commit -m "Merge ${worktree.id} (AI resolved)"
          `);

          mergeResults.push({
            worktreeId: worktree.id,
            success: true,
            conflicts: conflicts.map(c => ({ ...c, resolved: true }))
          });
        } else {
          // Could not resolve
          mergeResults.push({
            worktreeId: worktree.id,
            success: false,
            conflicts
          });

          // Abort this merge
          await execAsync(`cd ${previewPath} && git merge --abort`);
          break;
        }
      }
    }

    return {
      id: previewId,
      path: previewPath,
      branch: previewBranch,
      mergedWorktrees: selectedWorktrees.map(w => w.id),
      mergeResults,
      createdAt: Date.now()
    };
  }

  private async getConflicts(repoPath: string): Promise<ConflictInfo[]> {
    const result = await execAsync(`
      cd ${repoPath}
      git diff --name-only --diff-filter=U
    `);

    const conflictFiles = result.stdout.trim().split('\\n');
    const conflicts: ConflictInfo[] = [];

    for (const file of conflictFiles) {
      const content = fs.readFileSync(
        path.join(repoPath, file),
        'utf-8'
      );

      conflicts.push({
        file,
        content,
        regions: this.parseConflictMarkers(content)
      });
    }

    return conflicts;
  }

  private parseConflictMarkers(content: string): ConflictRegion[] {
    const regions: ConflictRegion[] = [];
    const lines = content.split('\\n');

    let inConflict = false;
    let currentRegion: Partial<ConflictRegion> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        currentRegion = { startLine: i, ourContent: '' };
      } else if (line.startsWith('=======')) {
        currentRegion.theirContent = '';
      } else if (line.startsWith('>>>>>>>')) {
        currentRegion.endLine = i;
        regions.push(currentRegion as ConflictRegion);
        inConflict = false;
        currentRegion = {};
      } else if (inConflict) {
        if (currentRegion.theirContent !== undefined) {
          currentRegion.theirContent += line + '\\n';
        } else {
          currentRegion.ourContent += line + '\\n';
        }
      }
    }

    return regions;
  }
}

```

---

## 3. User Interface Design

### 3.1 VS Code Extension Views

```tsx
// extensions/paralleldev/src/views/ParallelDevPanel.ts

export class ParallelDevPanel {
  private panel: vscode.WebviewPanel;

  constructor(extensionUri: vscode.Uri) {
    this.panel = vscode.window.createWebviewPanel(
      'paralleldev.main',
      'ParallelDev',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.webview.html = this.getWebviewContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message)
    );
  }

  private getWebviewContent(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ParallelDev</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
    }

    .section { margin-bottom: 30px; }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
      color: var(--vscode-titleBar-activeForeground);
    }

    /* Task List */
    .task-list { list-style: none; }
    .task-item {
      padding: 12px;
      margin-bottom: 8px;
      background: var(--vscode-editor-lineHighlightBackground);
      border-radius: 4px;
      border-left: 3px solid var(--vscode-textLink-foreground);
    }
    .task-item.parallel { border-left-color: var(--vscode-charts-blue); }
    .task-item.sequential { border-left-color: var(--vscode-charts-orange); }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .task-badge {
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-parallel { background: rgba(0,122,204,0.2); color: #007acc; }
    .badge-sequential { background: rgba(255,140,0,0.2); color: #ff8c00; }

    /* Conflict Matrix */
    .matrix {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 10px;
    }

    .matrix-cell {
      padding: 20px;
      text-align: center;
      border-radius: 4px;
      border: 1px solid var(--vscode-panel-border);
    }

    .matrix-cell.success { background: rgba(0,255,0,0.1); }
    .matrix-cell.warning { background: rgba(255,255,0,0.1); }
    .matrix-cell.error { background: rgba(255,0,0,0.1); }

    /* Preview Selector */
    .worktree-selector {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .worktree-checkbox {
      display: flex;
      align-items: center;
      padding: 10px;
      background: var(--vscode-editor-lineHighlightBackground);
      border-radius: 4px;
    }

    .worktree-checkbox input[type="checkbox"] {
      margin-right: 10px;
    }

    /* Buttons */
    .btn {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-primary { background: var(--vscode-button-background); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); }
  </style>
</head>
<body>
  <div class="section">
    <h2 class="section-title">Spec Kit Tasks</h2>
    <ul class="task-list" id="task-list"></ul>
    <button class="btn btn-primary" onclick="executeParallelTasks()">
      Execute Parallel Tasks
    </button>
  </div>

  <div class="section">
    <h2 class="section-title">Conflict Matrix</h2>
    <div class="matrix" id="conflict-matrix"></div>
  </div>

  <div class="section">
    <h2 class="section-title">Preview Merge</h2>
    <div class="worktree-selector" id="worktree-selector"></div>
    <button class="btn btn-primary" onclick="createPreview()">
      Create Preview
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Load initial data
    window.addEventListener('load', () => {
      vscode.postMessage({ command: 'load' });
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'tasks':
          renderTasks(message.tasks);
          break;
        case 'conflicts':
          renderConflictMatrix(message.matrix);
          break;
        case 'worktrees':
          renderWorktreeSelector(message.worktrees);
          break;
      }
    });

    function renderTasks(tasks) {
      const list = document.getElementById('task-list');
      list.innerHTML = tasks.map(task => \\`
        <li class="task-item \\${task.parallel ? 'parallel' : 'sequential'}">
          <div class="task-header">
            <span>\\${task.title}</span>
            <span class="task-badge badge-\\${task.parallel ? 'parallel' : 'sequential'}">
              \\${task.parallel ? 'PARALLEL' : 'SEQUENTIAL'}
            </span>
          </div>
          <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 5px;">
            Phase: \\${task.phase} | Complexity: \\${task.estimatedComplexity}/5
          </div>
        </li>
      \\`).join('');
    }

    function renderConflictMatrix(matrix) {
      const container = document.getElementById('conflict-matrix');
      const html = [];

      for (const [key, result] of Object.entries(matrix.conflicts)) {
        const [a, b] = key.split(':');
        const cssClass = result.canMerge ? 'success' :
                        result.conflictSeverity === 'minor' ? 'warning' : 'error';

        html.push(\\`
          <div class="matrix-cell \\${cssClass}">
            <div>\\${a} ↔ \\${b}</div>
            <div style="font-size: 20px; margin: 10px 0;">
              \\${result.canMerge ? '✓' : '✗'}
            </div>
            <div style="font-size: 11px;">
              \\${result.conflictFiles.length} conflicts
            </div>
          </div>
        \\`);
      }

      container.innerHTML = html.join('');
    }

    function renderWorktreeSelector(worktrees) {
      const container = document.getElementById('worktree-selector');
      container.innerHTML = worktrees.map(wt => \\`
        <label class="worktree-checkbox">
          <input type="checkbox" value="\\${wt.id}" />
          <span>\\${wt.id} - \\${wt.taskId}</span>
        </label>
      \\`).join('');
    }

    function executeParallelTasks() {
      vscode.postMessage({ command: 'executeParallel' });
    }

    function createPreview() {
      const selected = Array.from(
        document.querySelectorAll('.worktree-checkbox input:checked')
      ).map(el => el.value);

      vscode.postMessage({
        command: 'createPreview',
        worktrees: selected
      });
    }
  </script>
</body>
</html>
    `;
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'load':
        await this.loadData();
        break;
      case 'executeParallel':
        await this.executeParallelTasks();
        break;
      case 'createPreview':
        await this.createPreview(message.worktrees);
        break;
    }
  }

  private async loadData(): Promise<void> {
    // Load Spec Kit tasks
    const parser = new SpecKitParser();
    const plan = await parser.parsePlan(vscode.workspace.rootPath);

    this.panel.webview.postMessage({
      type: 'tasks',
      tasks: plan.tasks
    });
  }

  private async executeParallelTasks(): Promise<void> {
    const orchestrator = new AgentOrchestrator(
      vscode.workspace.rootPath,
      continueAPI
    );

    // Get parallel tasks from current phase
    const parser = new SpecKitParser();
    const plan = await parser.parsePlan(vscode.workspace.rootPath);
    const parallelTasks = plan.tasks.filter(t => t.parallel && t.status === 'pending');

    // Execute
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Executing ${parallelTasks.length} parallel tasks`,
      cancellable: false
    }, async (progress) => {
      const results = await orchestrator.executeParallelTasks(parallelTasks);

      // Get worktrees
      const worktrees = await this.worktreeManager.listWorktrees();

      // Build conflict matrix
      const detector = new ConflictDetector();
      const matrix = await detector.buildConflictMatrix(worktrees);

      // Update UI
      this.panel.webview.postMessage({
        type: 'conflicts',
        matrix
      });

      this.panel.webview.postMessage({
        type: 'worktrees',
        worktrees
      });
    });
  }

  private async createPreview(worktreeIds: string[]): Promise<void> {
    const worktrees = await Promise.all(
      worktreeIds.map(id => this.worktreeManager.getWorktree(id))
    );

    const generator = new PreviewGenerator();
    const preview = await generator.createPreviewMerge(
      worktrees.filter(w => w !== undefined),
      vscode.workspace.rootPath
    );

    // Open preview in new window
    vscode.commands.executeCommand(
      'vscode.openFolder',
      vscode.Uri.file(preview.path),
      true // forceNewWindow
    );
  }
}

```

---

## 4. Build & Distribution

### 4.1 Build System

```json
// package.json (root)
{
  "name": "paralleldev",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build:vscode": "cd vscode && yarn && yarn gulp vscode-linux-x64",
    "build:continue": "cd extensions/continue && npm install && npm run build",
    "build:paralleldev": "cd extensions/paralleldev && npm install && npm run build",
    "build": "npm run build:continue && npm run build:paralleldev && npm run build:vscode",
    "dev": "concurrently \\"npm run dev:continue\\" \\"npm run dev:paralleldev\\" \\"npm run dev:vscode\\"",
    "dev:vscode": "cd vscode && yarn watch",
    "dev:continue": "cd extensions/continue && npm run watch",
    "dev:paralleldev": "cd extensions/paralleldev && npm run watch"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}

```

### 4.2 Distribution Strategy

**Local MVP Distribution:**

- GitHub Releases with pre-built binaries
- Platforms: macOS (arm64/x64), Linux (x64), Windows (x64)
- Auto-update via VS Code's update mechanism

```bash
# Build script
./scripts/build-release.sh

# Output:
# - ParallelDev-darwin-arm64.zip
# - ParallelDev-darwin-x64.zip
# - ParallelDev-linux-x64.tar.gz
# - ParallelDev-win32-x64.zip

```

---

## 5. Development Phases

### Phase 1: Foundation (Weeks 1-4)

- [ ]  Fork VS Code and Continue.dev
- [ ]  Set up build system
- [ ]  Basic extension scaffolding
- [ ]  LSP client implementation (Crush style)
- [ ]  Code execution provider (E2B integration)

**Milestone:** Can execute code with MCP tools in E2B sandbox

### Phase 2: Spec Kit Integration (Weeks 5-6)

- [ ]  Spec Kit parser
- [ ]  Task visualization UI
- [ ]  Phase/task tracking

**Milestone:** Can parse and display Spec Kit tasks

### Phase 3: Worktree Orchestration (Weeks 7-9)

- [ ]  Worktree manager
- [ ]  Agent orchestrator
- [ ]  Parallel task execution
- [ ]  LSP diagnostics collection

**Milestone:** Can execute parallel tasks in separate worktrees

### Phase 4: Conflict Detection (Weeks 10-11)

- [ ]  Conflict detector
- [ ]  Conflict matrix visualization
- [ ]  AI-powered conflict resolution

**Milestone:** Can detect and display conflicts between worktrees

### Phase 5: Preview System (Weeks 12-13)

- [ ]  Preview merge generator
- [ ]  Worktree selector UI
- [ ]  Merge orchestration

**Milestone:** Can create and preview merged worktrees

### Phase 6: Polish & Testing (Weeks 14-16)

- [ ]  Error handling
- [ ]  Performance optimization
- [ ]  Documentation
- [ ]  User testing
- [ ]  Bug fixes

**Milestone:** Production-ready local MVP

---

## 6. Technical Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
| --- | --- | --- | --- |
| **VS Code fork maintenance burden** | High | High | Minimize fork changes; automate upstream syncs |
| **E2B sandbox stability** | Medium | Low | Implement fallback to local execution |
| **LSP server crashes** | Medium | Medium | Auto-restart with exponential backoff |
| **Conflict resolution accuracy** | High | High | Allow manual override; improve prompts iteratively |
| **Worktree merge failures** | Medium | Medium | Comprehensive error handling; user fallbacks |
| **Performance with many worktrees** | Medium | Low | Limit parallel tasks to 4-6; cleanup old worktrees |

---

## 7. Success Metrics

**Technical Metrics:**

- Conflict detection accuracy: >85%
- AI resolution success rate: >60%
- Parallel task execution time: <2x sequential time
- LSP response time: <500ms

**Product Metrics:**

- Tasks per session: 4-8
- Conflict resolution attempts: <3 per conflict
- Preview iterations: <3 before commit
- User abandonment rate: <20%

---

## 8. Future Enhancements (Post-MVP)

1. **Cloud Orchestration:** Run agents and previews in cloud
2. **Shadow Workspace:** Implement Cursor-style validation
3. **Knowledge Graphs:** Temporal code understanding
4. **Team Collaboration:** Shared agent sessions
5. **Custom Agent Strategies:** User-defined agent behaviors

---

## Conclusion

This design prioritizes:

- **Feasibility:** Uses proven technologies (git, LSP, E2B)
- **Simplicity:** Minimal VS Code fork, standard git workflows
- **Value:** Solves real problem (parallel implementation comparison)
- **Achievability:** 16-week timeline for solo developer

The architecture is modular, allowing incremental development and testing at each phase.

Sources