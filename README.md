
# Code Mode: 98% Token Reduction for AI Agent Workflows

**Created by [Connor Belez](https://github.com/Connorbelez)** | Built on [Continue.dev](https://continue.dev)

> **Reduce AI agent token usage by up to 98%** while unlocking true composability for MCP tool calls.
> **Works with any MCP server out of the box.** Zero modifications needed.

<p align="center">
  <strong>Same workflows. 50x fewer tokens. 50x lower costs.</strong>
</p>

---

## About

Code Mode is an experimental enhancement to Continue.dev that introduces a novel approach to AI tool calling. Instead of verbose JSON schemas sent with every request, agents write and execute **TypeScript code in secure sandboxes**, enabling massive token reduction and true workflow composability.

**Author:** Connor Belez
**Based on:** [Continue.dev](https://continue.dev) (Apache 2.0)
**Status:** Independent fork with production-ready MCP implementation

---

## 🎯 The Problem

Traditional MCP tool calling burns massive context on multi-step workflows:

```
Task: "Update priority labels on 50 GitHub issues"

Traditional Tool Calling:
├─ Round 1: List issues → 20,000 tokens (schemas + results)
├─ Round 2: Filter issues → 25,000 tokens (schemas + history + results)
├─ Round 3-52: Update each issue → 450,000+ tokens total
└─ Cost: $0.90 with GPT-4 | Time: 45 seconds

Problems:
❌ Every tool call goes through the LLM
❌ Full tool schemas sent in every request
❌ Results accumulate in context
❌ No way to compose, filter, or parallelize
```

## ✨ The Solution

**Code Mode lets agents write TypeScript that executes multi-step workflows without LLM round-trips:**

```typescript
import { github } from '/mcp';

const issues = await github.listIssues({ state: 'open' });
const bugs = issues.filter(i => i.labels.includes('bug'));

await Promise.all(
  bugs.map(bug =>
    github.updateIssue({
      number: bug.number,
      labels: [...bug.labels, 'high-priority']
    })
  )
);

return `Updated ${bugs.length} issues`;
```

```
Code Mode:
├─ Single execution in sandbox → 8,000 tokens
├─ Cost: $0.016 with GPT-4 | Time: 12 seconds
└─ Reduction: 98.2% tokens | 98.2% cost | 73% faster

Benefits:
✅ Multi-step logic runs in code (no LLM round-trips)
✅ Filter/process data before returning to context
✅ Full composability (loops, async, error handling)
✅ Type safety with TypeScript
```

---

## 📊 Benchmarks: Real Token Savings

| Workflow | Traditional Tokens | Code Mode Tokens | Reduction | Traditional Cost | Code Mode Cost | Savings |
|----------|-------------------|------------------|-----------|------------------|----------------|---------|
| **GitHub: Update 50 issues** | 450,000 | 8,000 | **98.2%** | $0.90 | $0.016 | **98.2%** |
| **Filesystem: Process 100 files** | 380,000 | 6,500 | **98.3%** | $0.76 | $0.013 | **98.3%** |
| **Multi-tool: Search + Analyze** | 180,000 | 5,200 | **97.1%** | $0.36 | $0.010 | **97.2%** |
| **Data Pipeline: Filter + Transform** | 220,000 | 4,800 | **97.8%** | $0.44 | $0.010 | **97.7%** |

**Methodology:** GPT-4 pricing ($0.002/1K tokens). See [benchmarks/](benchmarks/) for full details.

---

## 🚀 Why This Matters

### 1. **Massive Token Reduction** (75-98%)
- Tool schemas only loaded when imported (not in every request)
- Data filtering/processing happens in code
- Multi-step workflows execute without LLM involvement

### 2. **True Composability**
Do things impossible with traditional tool calling:

```typescript
// Parallel execution
const results = await Promise.all(
  repos.map(r => github.listIssues({ repo: r.name }))
);

// Complex filtering
const critical = results.flat()
  .filter(i => i.priority === 'P0' && !i.assignee);

// Conditional logic
for (const issue of critical) {
  if (issue.age > 30) {
    await github.addLabel({ issue: issue.number, label: 'stale' });
  }
}
```

**Try doing that with traditional tool calling** → 50+ LLM round-trips

### 3. **Drop-in Solution**
- Works with ANY MCP server (no modifications)
- Automatic TypeScript generation from JSON schemas
- Compatible with all MCP transports (STDIO, SSE, HTTP, WebSocket)

---

## What is Code Mode?

Instead of agents generating JSON for each tool call:

```json
{
  "toolCalls": [
    {
      "type": "function",
      "function": {
        "name": "github_create_issue",
        "arguments": "{\"title\": \"Bug\", \"body\": \"...\"}"
      }
    }
  ]
}
```

They write TypeScript that executes in a secure sandbox:

```typescript
import { github } from "/mcp";

await github.createIssue({
  title: "Bug",
  body: "...",
});
```

**Key Innovation:** Multi-step workflows run in code, not through the LLM

---

## Current Status: MCP Tools

Code Mode is **production-ready** for **Model Context Protocol (MCP) servers**. This means:

✅ **Automatic TypeScript generation** from any MCP server
✅ **Plug-and-play** with existing MCP servers (no code changes needed)
✅ **Type-safe** function calls with full IntelliSense
✅ **Progressive disclosure** (tool schemas loaded on-demand via imports)
✅ **Sandboxed execution** in E2B cloud microVMs
✅ **Production tested** with real users across VS Code, JetBrains, and CLI

---

## 🔌 Plug-and-Play with MCP Servers

**No modifications needed to MCP servers!** If you have an MCP server running, Code Mode automatically:

1. ✅ Discovers all available tools via `listTools()`
2. ✅ Generates TypeScript wrappers from JSON schemas
3. ✅ Creates virtual filesystem at `/mcp/{server-name}/`
4. ✅ Provides full type safety and IntelliSense
5. ✅ Handles all RPC communication transparently

**Example:** Add GitHub MCP server

```yaml
# .continue/config.yaml
mcpServers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

**That's it!** Now your agent can:

```typescript
import { github } from '/mcp';

// All tools automatically available with types!
await github.createIssue({ ... });
await github.listIssues({ ... });
await github.searchRepositories({ ... });
// etc.
```

---

## Quick Start

### 1. Prerequisites

- Continue extension installed ([VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue) | [JetBrains](https://plugins.jetbrains.com/plugin/22707-continue))
- [E2B API key](https://e2b.dev) (free tier available)
- One or more MCP servers configured

### 2. Enable Code Mode

Edit your `.continue/config.yaml`:

```yaml
experimental:
  codeExecution:
    enabled: true
    e2bApiKey: "your-e2b-api-key" # Get from https://e2b.dev

# Configure MCP servers (example)
mcpServers:
  github:
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-github"
    env:
      GITHUB_TOKEN: "your-github-token"

  filesystem:
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/path/to/allowed/directory"
```

### 3. Use in Prompts

Ask your agent to perform multi-step tasks:

**Example 1: GitHub Issue Analysis**

> "Find all open bugs in the repo, filter by those labeled 'priority:high', and create a summary report"

The agent will write:

```typescript
import { github } from '/mcp';

// Get all open issues
const issues = await github.listIssues({
  state: 'open'
});

// Filter in CODE (not in context!) - saves tokens
const bugs = issues.filter(i =>
  i.labels.some(l => l.name === 'bug')
);

const highPriority = bugs.filter(i =>
  i.labels.some(l => l.name === 'priority:high')
);

// Generate report
console.log(`Found ${highPriority.length} high-priority bugs out of ${bugs.length} total bugs`);

// Return structured data
{
  totalIssues: issues.length,
  bugs: bugs.length,
  highPriority: highPriority.length,
  details: highPriority.map(b => ({
    number: b.number,
    title: b.title,
    created: b.created_at
  }))
}
```

**Example 2: File System Operations**

> "Read all TypeScript files in /src, count TODO comments, and save the results"

```typescript
import { filesystem } from "/mcp";

// List all .ts files
const files = await filesystem.listDirectory({ path: "/src" });
const tsFiles = files.filter((f) => f.name.endsWith(".ts"));

let totalTodos = 0;
const results = [];

// Process each file
for (const file of tsFiles) {
  const content = await filesystem.readFile({
    path: `/src/${file.name}`,
  });

  const todos = (content.match(/\/\/ TODO:/g) || []).length;
  totalTodos += todos;

  if (todos > 0) {
    results.push({ file: file.name, todos });
  }
}

// Save report
await filesystem.writeFile({
  path: "/todo-report.json",
  content: JSON.stringify(
    {
      totalFiles: tsFiles.length,
      totalTodos,
      details: results,
    },
    null,
    2,
  ),
});

console.log(`Found ${totalTodos} TODOs across ${tsFiles.length} files`);
```

---

## How It Works: Architecture

### High-Level Flow

```mermaid
flowchart LR
    MCP[MCP Servers<br/>GitHub, Filesystem, etc.]

    GEN[Code Generator<br/>JSON Schema → TypeScript]

    VFS[Virtual Filesystem<br/>/mcp/github/*.ts<br/>/mcp/filesystem/*.ts]

    AGENT[AI Agent<br/>Writes TypeScript]

    SANDBOX[E2B Sandbox<br/>Executes code safely]

    IPC[File-based IPC<br/>Sandbox ↔ Host]

    MCP -->|Tool schemas| GEN
    GEN -->|Generated .ts files| VFS
    AGENT -->|import from /mcp| VFS
    VFS -->|Type-safe code| SANDBOX
    SANDBOX -->|RPC calls| IPC
    IPC -->|Forward to| MCP
    MCP -->|Results| IPC
    IPC -->|Return values| SANDBOX
```

### Detailed Architecture Diagram

```mermaid
sequenceDiagram
    participant User as Developer
    participant Config as Continue Config
    participant MCP as MCP Server
    participant Gen as TypeScript Generator
    participant VFS as Virtual FS (/mcp/*)
    participant Agent as AI Agent
    participant E2B as E2B Sandbox
    participant Host as Continue Host

    Note over User,Config: Setup Phase
    User->>Config: Configure MCP server<br/>(mcpServers in config.yaml)
    Config->>MCP: Start MCP server process

    Note over MCP,VFS: Code Generation (Automatic)
    Config->>MCP: listTools()
    MCP-->>Config: Return tool schemas<br/>(JSON Schema format)
    Config->>Gen: Generate TypeScript wrappers
    Gen->>Gen: Convert JSON Schema → TS types
    Gen->>VFS: Write /mcp/github/createIssue.ts<br/>/mcp/github/listIssues.ts<br/>etc.

    Note over Agent,E2B: Runtime (Agent Execution)
    User->>Agent: "Create a GitHub issue..."
    Agent->>Agent: Generate TypeScript code<br/>with imports
    Agent->>E2B: Execute code in sandbox

    E2B->>VFS: import { github } from '/mcp'
    VFS-->>E2B: Load generated types
    E2B->>E2B: TypeScript type checking

    E2B->>E2B: await github.createIssue({...})
    Note over E2B: Calls globalThis.__mcp_invoke

    E2B->>Host: Write request to<br/>/tmp/continue_mcp/requests/{uuid}.json
    Host->>Host: Detect request file
    Host->>MCP: Forward tool call via MCP protocol
    MCP-->>Host: Return result
    Host->>E2B: Write response to<br/>/tmp/continue_mcp/responses/{uuid}.json

    E2B->>E2B: Read response, resolve promise
    E2B-->>Agent: Return execution result
    Agent-->>User: Show formatted output

    style Gen fill:#e6f3ff,stroke:#0066cc,stroke-width:2px
    style VFS fill:#fff4e6,stroke:#ff9900,stroke-width:2px
    style E2B fill:#ffe6e6,stroke:#cc0000,stroke-width:2px
```

### Component Breakdown

#### 1. **MCP Servers** (Your Existing Tools)

Continue works with **any standard MCP server**. No modifications needed. Popular servers:

- [`@modelcontextprotocol/server-github`](https://github.com/modelcontextprotocol/servers/tree/main/src/github) - GitHub API
- [`@modelcontextprotocol/server-filesystem`](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) - File operations
- [`@modelcontextprotocol/server-google-drive`](https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive) - Google Drive
- [`@modelcontextprotocol/server-slack`](https://github.com/modelcontextprotocol/servers/tree/main/src/slack) - Slack integration
- [And many more...](https://github.com/modelcontextprotocol/servers)

#### 2. **Automatic TypeScript Generation**

**Input:** MCP server exposes tools via JSON Schema

```json
{
  "name": "create_issue",
  "description": "Create a new GitHub issue",
  "inputSchema": {
    "type": "object",
    "required": ["owner", "repo", "title"],
    "properties": {
      "owner": { "type": "string" },
      "repo": { "type": "string" },
      "title": { "type": "string" },
      "body": { "type": "string" },
      "labels": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }
}
```

**Output:** Continue generates TypeScript wrapper (`/mcp/github/createIssue.ts`)

```typescript
/**
 * Create a new GitHub issue
 */
export async function createIssue(args: {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}): Promise<{
  number: number;
  url: string;
  state: string;
}> {
  if (!globalThis.__mcp_invoke) {
    throw new Error("MCP client not initialized");
  }

  return await globalThis.__mcp_invoke(
    "github", // Server ID
    "create_issue", // Tool name
    args,
  );
}
```

**Key Features:**

- ✅ Full TypeScript type definitions
- ✅ JSDoc comments from descriptions
- ✅ Optional vs required parameters
- ✅ Return type inference
- ✅ Enum types for constrained values

#### 3. **Virtual Filesystem** (Progressive Disclosure)

Generated TypeScript files are organized by server:

```
/mcp/
├── github/
│   ├── createIssue.ts
│   ├── listIssues.ts
│   ├── searchRepositories.ts
│   └── index.ts
├── filesystem/
│   ├── readFile.ts
│   ├── writeFile.ts
│   ├── listDirectory.ts
│   └── index.ts
└── index.ts
```

**Progressive Discovery:** The agent can explore available tools:

```typescript
import fs from "fs";

// Discover available MCP servers
const servers = fs.readdirSync("/mcp");
console.log("Available servers:", servers);
// Output: ['github', 'filesystem', 'google-drive']

// Discover tools for a specific server
const githubTools = fs.readdirSync("/mcp/github");
console.log("GitHub tools:", githubTools);
// Output: ['createIssue.ts', 'listIssues.ts', 'searchRepositories.ts', 'index.ts']
```

**Token Savings:** Tool schemas are **only loaded when imported**, not sent in every request. This is the primary source of the 75-85% token reduction.

#### 4. **E2B Sandbox** (Secure Execution)

Agent code executes in an isolated [E2B](https://e2b.dev) Firecracker microVM:

**Security Properties:**

- ❌ No direct filesystem access
- ❌ No direct network access
- ❌ No ability to execute arbitrary binaries
- ✅ Only makes RPC calls to host via `globalThis.__mcp_invoke`
- ⏱️ Automatic timeout (configurable)
- 💾 Resource limits (CPU, memory, disk)

**State Persistence:** The sandbox persists for the duration of the conversation:

```typescript
// First execution
globalThis.cache = globalThis.cache || {};
globalThis.cache.repos = await github.listRepositories();

// Second execution (later in conversation)
// globalThis.cache.repos still available!
const cachedRepos = globalThis.cache.repos;
```

#### 5. **File-based IPC** (Sandbox ↔ Host Communication)

**Current Implementation:** The sandbox communicates with the host process via temporary files:

**Request Flow:**

1. Sandbox writes request to `/tmp/continue_mcp/requests/{uuid}.json`
2. Sandbox polls for response at `/tmp/continue_mcp/responses/{uuid}.json`
3. Host detects request file, executes tool, writes response file
4. Sandbox reads response, resolves promise

**Example `globalThis.__mcp_invoke` implementation:**

```typescript
globalThis.__mcp_invoke = async function invokeMCP(
  serverId: string,
  toolName: string,
  args: Record<string, unknown> = {},
) {
  const requestId = crypto.randomUUID();
  const requestPath = `/tmp/continue_mcp/requests/${requestId}.json`;
  const responsePath = `/tmp/continue_mcp/responses/${requestId}.json`;

  // Write request
  await fs.promises.writeFile(
    requestPath,
    JSON.stringify({
      serverId,
      toolName,
      arguments: args,
    }),
  );

  // Poll for response
  const maxAttempts = 100;
  const pollInterval = 100; // ms

  for (let i = 0; i < maxAttempts; i++) {
    if (await fileExists(responsePath)) {
      const response = JSON.parse(
        await fs.promises.readFile(responsePath, "utf-8"),
      );

      // Clean up
      await fs.promises.unlink(requestPath);
      await fs.promises.unlink(responsePath);

      if (response.error) {
        throw new Error(response.error);
      }

      return response.result;
    }

    await sleep(pollInterval);
  }

  throw new Error("MCP call timeout");
};
```

**Note:** File-based IPC was chosen for rapid prototyping. The roadmap includes migrating to WebSocket/HTTP/2 for lower latency and better observability.

---

## Real-World Examples

### Example 1: Multi-Tool GitHub Workflow

**Prompt:** "Find the top TypeScript repo, analyze its open issues, and create a summary"

**Generated Code:**

```typescript
import { github } from '/mcp';

// Search for TypeScript repos
const repos = await github.searchRepositories({
  query: 'language:typescript',
  sort: 'stars',
  order: 'desc',
  perPage: 10
});

const topRepo = repos[0];
console.log(`Analyzing: ${topRepo.full_name} (${topRepo.stars} stars)`);

// Get open issues
const issues = await github.listIssues({
  owner: topRepo.owner.login,
  repo: topRepo.name,
  state: 'open'
});

// Analyze in code (not in context!)
const byLabel = {};
for (const issue of issues) {
  for (const label of issue.labels) {
    byLabel[label.name] = (byLabel[label.name] || 0) + 1;
  }
}

// Sort labels by frequency
const topLabels = Object.entries(byLabel)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5);

console.log('Issue Summary:');
console.log(`- Total open issues: ${issues.length}`);
console.log(`- Top labels:`, topLabels);

// Return structured summary
{
  repository: topRepo.full_name,
  stars: topRepo.stars,
  openIssues: issues.length,
  topLabels: Object.fromEntries(topLabels),
  recentIssues: issues.slice(0, 5).map(i => ({
    number: i.number,
    title: i.title,
    created: i.created_at
  }))
}
```

**Why This Is Better:**

- **Without Code Mode:** Would require 5+ separate tool calls (search repos, get each repo's issues, multiple LLM round-trips to process results)
- **With Code Mode:** Single execution, all processing happens in code (saves tokens), immediate results

### Example 2: File System Data Processing

**Prompt:** "Count lines of code in all Python files and create a report"

```typescript
import { filesystem } from "/mcp";

async function countLines(path: string): Promise<number> {
  const content = await filesystem.readFile({ path });
  return content.split("\n").length;
}

// Get all Python files
const allFiles = await filesystem.listDirectoryRecursive({
  path: "/project",
});

const pythonFiles = allFiles.filter((f) => f.endsWith(".py"));

// Count LOC for each file
const results = [];
let totalLOC = 0;

for (const file of pythonFiles) {
  const loc = await countLines(file);
  totalLOC += loc;
  results.push({ file, loc });
}

// Sort by LOC
results.sort((a, b) => b.loc - a.loc);

// Save report
const report = {
  totalFiles: pythonFiles.length,
  totalLOC,
  averageLOC: Math.round(totalLOC / pythonFiles.length),
  largestFiles: results.slice(0, 10),
};

await filesystem.writeFile({
  path: "/loc-report.json",
  content: JSON.stringify(report, null, 2),
});

console.log(
  `Analyzed ${pythonFiles.length} Python files: ${totalLOC.toLocaleString()} total LOC`,
);
report;
```

### Example 3: OAuth + API Integration

**Prompt:** "Use Google Drive to find all PDFs modified in the last week"

```typescript
import { googleDrive } from "/mcp";

// OAuth handled by MCP server (configured in Continue)
// Agent just calls authenticated methods

const now = new Date();
const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

const files = await googleDrive.searchFiles({
  query: "mimeType='application/pdf'",
  modifiedAfter: weekAgo.toISOString(),
});

console.log(`Found ${files.length} PDFs modified in the last week`);

// Download metadata for each
const details = [];
for (const file of files) {
  const metadata = await googleDrive.getFileMetadata({
    fileId: file.id,
  });

  details.push({
    name: file.name,
    size: metadata.size,
    modifiedTime: metadata.modifiedTime,
    owner: metadata.owners[0]?.displayName,
  });
}

// Sort by modification time
details.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));

details;
```

---

## 🔥 Advanced Composition Examples

See [examples/advanced-composition/](examples/advanced-composition/) for production-ready patterns showing what's possible with Code Mode:

### 1. **Parallel Batch Operations** ([view code](examples/advanced-composition/01-parallel-batch-operations.ts))
Analyze 5 repos in parallel, filter stale issues, batch-update labels/comments.
- **Traditional:** 350K tokens, 200+ LLM calls
- **Code Mode:** 6K tokens, single execution
- **Savings:** 98.3% tokens, 98.3% cost

### 2. **Multi-Service Orchestration** ([view code](examples/advanced-composition/02-multi-service-orchestration.ts))
GitHub → analysis → filesystem reports → Slack notifications in one flow.
- **Traditional:** 280K tokens across GitHub, Filesystem, Slack
- **Code Mode:** 7K tokens
- **Savings:** 97.5%

### 3. **Data Pipeline with Error Handling** ([view code](examples/advanced-composition/03-data-pipeline-with-error-handling.ts))
Process files with validation, retry logic with exponential backoff, auto-issue creation.
- **Traditional:** Error handling nearly impossible
- **Code Mode:** Full try-catch, retries, graceful degradation
- **Savings:** 96.8%

### 4. **Stateful Caching** ([view code](examples/advanced-composition/04-stateful-caching-workflow.ts))
Intelligent caching using `globalThis` - cache persists across executions in same conversation.
- **First call:** 93.3% reduction
- **Subsequent calls:** 99.2% reduction (cache hits!)
- **Overall:** 96.8% across multiple executions

### 5. **Cross-Repository Analysis** ([view code](examples/advanced-composition/05-complex-cross-repo-analysis.ts))
Analyze dependencies, contributor overlap, code health across multiple repos with advanced algorithms.
- **Traditional:** 450K tokens, 300+ calls
- **Code Mode:** 6K tokens, parallel execution
- **Savings:** 98.7% tokens, 8× faster

**Average token reduction across examples: 97.7%**
**Average cost savings: $0.67 per workflow (43× cheaper)**

See the [examples README](examples/advanced-composition/README.md) for full details and token breakdowns.

---

## Advanced Features

### 1. Error Handling

Use standard try-catch patterns:

```typescript
import { github } from "/mcp";

try {
  const issue = await github.createIssue({
    owner: "myorg",
    repo: "myrepo",
    title: "Bug Report",
    body: "Description...",
  });

  console.log(`Created issue #${issue.number}`);
  return { success: true, issueNumber: issue.number };
} catch (error) {
  console.error("Failed to create issue:", error.message);

  // Fallback or retry logic
  return { success: false, error: error.message };
}
```

### 2. State Management

Use `globalThis` for persistent state across calls:

```typescript
// First execution in conversation
globalThis.rateLimitRemaining = globalThis.rateLimitRemaining || 5000;

import { github } from "/mcp";

const repos = await github.searchRepositories({ query: "typescript" });

// Update rate limit tracking
globalThis.rateLimitRemaining -= 1;
console.log(`Rate limit remaining: ${globalThis.rateLimitRemaining}`);

repos;
```

### 3. Async Workflows

Use async/await naturally:

```typescript
import { github, slack } from '/mcp';

// Run operations in parallel
const [issues, pullRequests] = await Promise.all([
  github.listIssues({ state: 'open' }),
  github.listPullRequests({ state: 'open' })
]);

// Process results
const summary = `
Repository Status:
- Open issues: ${issues.length}
- Open PRs: ${pullRequests.length}
- Needs attention: ${issues.filter(i => i.labels.includes('urgent')).length}
`;

// Send to Slack
await slack.postMessage({
  channel: '#dev-updates',
  text: summary
});

{ issues: issues.length, prs: pullRequests.length };
```

### 4. Data Filtering (Massive Token Savings)

Filter large datasets **in code** instead of sending to LLM:

```typescript
import { github } from "/mcp";

// Get ALL issues (potentially thousands)
const allIssues = await github.listIssues({
  state: "all",
  perPage: 100,
});

// Filter in CODE - only send filtered results to LLM!
const criticalBugs = allIssues.filter(
  (issue) =>
    issue.labels.some((l) => l.name === "bug") &&
    issue.labels.some((l) => l.name === "critical") &&
    !issue.assignee, // Unassigned
);

console.log(`Found ${criticalBugs.length} critical unassigned bugs`);

// Return ONLY the filtered subset (huge token savings)
criticalBugs.map((bug) => ({
  number: bug.number,
  title: bug.title,
  created: bug.created_at,
}));
```

**Token Comparison:**

- Without filtering: ~50,000 tokens (all issues in context)
- With filtering: ~500 tokens (only critical bugs in result)
- **Savings: 99%**

---

## Configuration Reference

### E2B Configuration

```yaml
experimental:
  codeExecution:
    enabled: true
    e2bApiKey: "e2b_xxxxxxxxxxxx"

    # Optional settings
    timeout: 300000 # Max execution time (ms), default 5 min
    template: "base" # E2B template, default "base"

    # Resource limits
    cpuCount: 2 # Number of CPUs
    memoryMB: 2048 # Memory in MB
```

### MCP Server Configuration

```yaml
mcpServers:
  # Example: GitHub
  github:
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-github"
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}" # Use env var

  # Example: Filesystem (with allowed paths)
  filesystem:
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/Users/me/projects" # Restrict to this directory
      - "/Users/me/documents"

  # Example: Custom MCP server
  custom:
    command: node
    args:
      - "/path/to/my-mcp-server.js"
    env:
      API_KEY: "${MY_API_KEY}"
      LOG_LEVEL: "debug"
```

### Security Settings

```yaml
experimental:
  codeExecution:
    # Require confirmation on first use per conversation
    requireFirstUseConfirmation: true # default: true

    # Tool policy (allowedWithoutPermission | allowedWithPermission | denied)
    defaultPolicy: "allowedWithPermission"
```

---

## Troubleshooting

### Issue: "E2B API key not configured"

**Solution:** Add your E2B API key to config:

```yaml
experimental:
  codeExecution:
    e2bApiKey: "your-key-here"
```

Get a free key at [e2b.dev](https://e2b.dev).

### Issue: "MCP server not found"

**Check:**

1. Server is configured in `mcpServers` section
2. Command is executable (`npx`, `node`, etc.)
3. Required environment variables are set

**Debug:**

```bash
# Test MCP server manually
npx -y @modelcontextprotocol/server-github
```

### Issue: "Tool call timeout"

**Causes:**

- MCP server is slow or unresponsive
- Network issues
- File-based IPC polling exceeded max attempts

**Solutions:**

1. Increase timeout: `experimental.codeExecution.timeout: 600000`
2. Check MCP server logs
3. Verify network connectivity

### Issue: "Import failed: module not found"

**Check:**

1. MCP server is running (check Continue logs)
2. Tool exists on server: `fs.readdirSync('/mcp/github')`
3. Server name matches config (case-sensitive)

---

## Performance Tips

### 1. Batch Operations

❌ **Don't:**

```typescript
for (const file of files) {
  await processFile(file); // Serial, slow
}
```

✅ **Do:**

```typescript
await Promise.all(
  files.map((file) => processFile(file)), // Parallel, fast
);
```

### 2. Progressive Disclosure

❌ **Don't load everything upfront:**

```typescript
import * from '/mcp/github';  // Loads all tools
```

✅ **Import only what you need:**

```typescript
import { createIssue, listIssues } from "/mcp/github"; // Minimal
```

### 3. Cache Results

```typescript
// Initialize cache
globalThis.cache = globalThis.cache || {};

// Check cache first
if (!globalThis.cache.repos) {
  globalThis.cache.repos = await github.listRepositories();
}

const repos = globalThis.cache.repos; // Reuse across calls
```

---

## Roadmap

### ✅ Completed (Production)

- [x] MCP server integration
- [x] Automatic TypeScript generation
- [x] E2B sandbox execution
- [x] File-based IPC
- [x] Progressive discovery
- [x] State persistence

### 🚧 In Progress

- [ ] WebSocket/HTTP/2 transport (replace file-based IPC)
- [ ] Built-in Continue tools (filesystem, git, terminal)
- [ ] tRPC server architecture
- [ ] Comprehensive middleware (security, rate limiting, audit logging)

### 🔜 Planned

- [ ] DEBUG_LAST_CALL observability system
- [ ] Tool marketplace
- [ ] Custom tool definitions
- [ ] Advanced auth flows (OAuth, API keys)
- [ ] Distributed execution (long-running jobs)

See the full [white paper](../research/code-mode-white-paper.md) for architectural details.

---

## Credits & Acknowledgments
We all stand on the shoulders of giants. 

### Code Mode Enhancements
**Connor Belez** - Architecture, implementation, and benchmarking
- MCP TypeScript wrapper generation system
- E2B sandbox integration for secure code execution
- File-based IPC protocol for MCP tool invocation
- Benchmark methodology and advanced composition examples

### Foundation & Inspiration
- **Continue.dev** - Extension framework and infrastructure ([continuedev/continue](https://github.com/continuedev/continue))
- **Anthropic** - Code execution mode research ([blog post](https://www.anthropic.com/engineering/code-execution-with-mcp))
- **Cloudflare** - Code Mode articulation by Kenton Varda & Sunil Pai ([blog post](https://blog.cloudflare.com/code-mode/))
- **Model Context Protocol** - Standard protocol for tool integration ([MCP](https://modelcontextprotocol.io))
- **E2B** - Secure code sandboxing infrastructure ([e2b.dev](https://e2b.dev))

---

## Resources

- **Code Mode Repository:** [github.com/Connorbelez/codeMode](https://github.com/Connorbelez/codeMode)
- **Continue.dev:** [continue.dev](https://continue.dev)
- **MCP Servers:** [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
- **E2B Documentation:** [e2b.dev/docs](https://e2b.dev/docs)
- **Continue Discord:** [discord.gg/vapESyrFmJ](https://discord.gg/vapESyrFmJ)

---

## License

**Code Mode** © 2024 Connor Belez

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

---

### Third-Party Licenses

This project builds upon and includes code from:

**Continue.dev Framework**
Copyright © 2023-2024 Continue Dev, Inc.
Licensed under the Apache License, Version 2.0

See [ATTRIBUTION.md](ATTRIBUTION.md) for complete third-party license information.

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

For questions or discussions, open an issue on [GitHub](https://github.com/Connorbelez/codeMode/issues).
