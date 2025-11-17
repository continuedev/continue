import { Sandbox } from "@e2b/code-interpreter";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { JSONSchema7 } from "json-schema";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { ToolImpl } from ".";
import type { ContextItem, IDE } from "../..";
import { LspMcpBridge, LSP_TOOLS } from "../../context/lsp/index.js";
import { MCPManagerSingleton } from "../../context/mcp/MCPManagerSingleton";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { Telemetry } from "../../util/posthog";
import { getStringArg } from "../parseArgs";
import {
  executeCodePolicy,
  resolveCodeExecutionConfig,
} from "../policies/executeCodePolicy";

const MCP_ROOT_DIR = "/tmp/continue_mcp";
const MCP_REQUEST_DIR = `${MCP_ROOT_DIR}/requests`;
const MCP_RESPONSE_DIR = `${MCP_ROOT_DIR}/responses`;
const MCP_POLL_INTERVAL_MS = 200;
const MCP_RESPONSE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

const LSP_ROOT_DIR = "/tmp/continue_lsp";
const LSP_REQUEST_DIR = `${LSP_ROOT_DIR}/requests`;
const LSP_RESPONSE_DIR = `${LSP_ROOT_DIR}/responses`;
const LSP_POLL_INTERVAL_MS = 200;
const LSP_RESPONSE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

const LANGUAGE_MAP: Record<string, "ts" | "js"> = {
  ts: "ts",
  typescript: "ts",
  javascript: "js",
  js: "js",
};

const FALLBACK_CONVERSATION_ID = "__global__";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ManagedSession = {
  sandbox: Sandbox;
  lastUsed: number;
  timeoutMs: number;
  monitor: McpRequestMonitor;
  lspMonitor: LspRequestMonitor;
  conversationId: string;
};

class SandboxSessionManager {
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly cleanupTimer: NodeJS.Timeout;
  private readonly wrapperGenerator = new McpWrapperGenerator();

  constructor() {
    this.cleanupTimer = setInterval(() => {
      void this.cleanupIdleSessions();
    }, 60_000);
    this.cleanupTimer.unref();
  }

  async getSession(
    conversationId: string | undefined,
    apiKey: string,
    requestTimeoutMs: number,
    sessionTimeoutMinutes: number,
    ide: IDE,
  ): Promise<ManagedSession> {
    const key = this.normalizeConversationId(conversationId);
    let session = this.sessions.get(key);

    if (session) {
      session.lastUsed = Date.now();
      return session;
    }

    const sandbox = await Sandbox.create({
      apiKey,
      timeoutMs: sessionTimeoutMinutes * 60_000,
      requestTimeoutMs,
    });

    await this.initializeSandbox(sandbox, ide);
    const monitor = new McpRequestMonitor(sandbox);
    monitor.start();

    const lspMonitor = new LspRequestMonitor(sandbox, ide);
    lspMonitor.start();

    session = {
      sandbox,
      lastUsed: Date.now(),
      timeoutMs: sessionTimeoutMinutes * 60_000,
      monitor,
      lspMonitor,
      conversationId: key,
    };
    this.sessions.set(key, session);
    void Telemetry.capture("sandbox_created", {
      conversationId: key,
      sandboxId: sandbox.sandboxId,
    });
    return session;
  }

  async disposeSession(key: string, reason: "idle" | "manual") {
    const session = this.sessions.get(key);
    if (!session) {
      return;
    }

    this.sessions.delete(key);
    executeCodePolicy.clearConversation(key);
    await session.monitor.stop();
    await session.lspMonitor.stop();
    try {
      await session.sandbox.kill();
    } catch {
      // ignore
    }

    const basePayload = {
      conversationId: key,
      sandboxId: session.sandbox.sandboxId,
    };
    void Telemetry.capture("sandbox_killed", basePayload);
    if (reason === "idle") {
      void Telemetry.capture("sandbox_idle_cleanup", {
        ...basePayload,
        idleMinutes: session.timeoutMs / 60_000,
      });
    }
  }

  private async initializeSandbox(sandbox: Sandbox, ide: IDE) {
    await sandbox.commands.run(
      `mkdir -p ${MCP_REQUEST_DIR} ${MCP_RESPONSE_DIR} ${LSP_REQUEST_DIR} ${LSP_RESPONSE_DIR}`,
    );
    const files = await this.wrapperGenerator.generate(ide);
    for (const file of files) {
      await sandbox.files.write(file.path, file.content);
    }
    await sandbox.runCode(this.buildBridgeBootstrap(), { language: "ts" });
  }

  private buildBridgeBootstrap() {
    return `import { promises as fs } from "fs";
import { randomUUID } from "crypto";

const REQUEST_DIR = ${JSON.stringify(MCP_REQUEST_DIR)};
const RESPONSE_DIR = ${JSON.stringify(MCP_RESPONSE_DIR)};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

globalThis.__mcp_invoke = async function invokeMCP(
  serverId: string,
  toolName: string,
  args: Record<string, unknown> = {},
) {
  const requestId = randomUUID();
  const fileName = requestId + ".json";
  const requestPath = ${JSON.stringify(`${MCP_REQUEST_DIR}/`)} + fileName;
  const responsePath = ${JSON.stringify(`${MCP_RESPONSE_DIR}/`)} + fileName;

  await fs.mkdir(REQUEST_DIR, { recursive: true });
  await fs.mkdir(RESPONSE_DIR, { recursive: true });
  await fs.writeFile(
    requestPath,
    JSON.stringify({ id: requestId, serverId, toolName, args }),
    "utf-8",
  );

  const start = Date.now();
  while (true) {
    try {
      const raw = await fs.readFile(responsePath, "utf-8");
      await fs.rm(requestPath, { force: true }).catch(() => {});
      await fs.rm(responsePath, { force: true }).catch(() => {});
      const parsed = JSON.parse(raw);
      if (parsed.success) {
        return parsed.result;
      }
      const err = new Error(parsed.error?.message || "MCP invocation failed");
      if (parsed.error?.type) {
        err.name = parsed.error.type;
      }
      throw err;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        if (Date.now() - start > ${MCP_RESPONSE_TIMEOUT_MS}) {
          throw new Error("Timed out waiting for MCP tool response");
        }
        await wait(100);
        continue;
      }
      throw err;
    }
  }
};

// LSP Bridge
const LSP_REQUEST_DIR = ${JSON.stringify(LSP_REQUEST_DIR)};
const LSP_RESPONSE_DIR = ${JSON.stringify(LSP_RESPONSE_DIR)};

globalThis.__lsp_invoke = async function invokeLSP(
  toolName: string,
  args: Record<string, unknown> = {},
) {
  const requestId = randomUUID();
  const fileName = requestId + ".json";
  const requestPath = ${JSON.stringify(`${LSP_REQUEST_DIR}/`)} + fileName;
  const responsePath = ${JSON.stringify(`${LSP_RESPONSE_DIR}/`)} + fileName;

  await fs.mkdir(LSP_REQUEST_DIR, { recursive: true });
  await fs.mkdir(LSP_RESPONSE_DIR, { recursive: true });
  await fs.writeFile(
    requestPath,
    JSON.stringify({ id: requestId, toolName, args }),
    "utf-8",
  );

  const start = Date.now();
  while (true) {
    try {
      const raw = await fs.readFile(responsePath, "utf-8");
      await fs.rm(requestPath, { force: true }).catch(() => {});
      await fs.rm(responsePath, { force: true }).catch(() => {});
      const parsed = JSON.parse(raw);
      if (parsed.success) {
        return parsed.result;
      }
      const err = new Error(parsed.error?.message || "LSP invocation failed");
      if (parsed.error?.type) {
        err.name = parsed.error.type;
      }
      throw err;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        if (Date.now() - start > ${LSP_RESPONSE_TIMEOUT_MS}) {
          throw new Error("Timed out waiting for LSP response");
        }
        await wait(100);
        continue;
      }
      throw err;
    }
  }
};

"mcp and lsp bridges ready";`;
  }

  private async cleanupIdleSessions() {
    const now = Date.now();
    const removals: Promise<void>[] = [];
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastUsed > session.timeoutMs) {
        removals.push(this.disposeSession(key, "idle"));
      }
    }
    await Promise.all(removals);
  }

  private normalizeConversationId(conversationId: string | undefined) {
    return conversationId ?? FALLBACK_CONVERSATION_ID;
  }

  async clearAllSessions() {
    const keys = Array.from(this.sessions.keys());
    await Promise.all(keys.map((key) => this.disposeSession(key, "manual")));
  }
}

class McpRequestMonitor {
  private stopped = false;
  private loopPromise: Promise<void> | null = null;

  constructor(private readonly sandbox: Sandbox) {}

  start() {
    if (this.loopPromise) {
      return;
    }
    this.stopped = false;
    this.loopPromise = this.loop();
  }

  async stop() {
    this.stopped = true;
    if (this.loopPromise) {
      try {
        await this.loopPromise;
      } catch {
        // ignore
      }
      this.loopPromise = null;
    }
  }

  private async loop() {
    while (!this.stopped) {
      try {
        await this.processOnce();
      } catch {
        // ignore
      }
      await delay(MCP_POLL_INTERVAL_MS);
    }
  }

  private async processOnce() {
    let entries;
    try {
      entries = await this.sandbox.files.list(MCP_REQUEST_DIR);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.type !== "file") {
        continue;
      }
      await this.handleRequest(entry.path);
    }
  }

  private async handleRequest(requestPath: string) {
    const fileName = path.posix.basename(requestPath);
    const responsePath = path.posix.join(MCP_RESPONSE_DIR, fileName);
    let payload: McpInvocationRequest | undefined;
    try {
      const raw = await this.sandbox.files.read(requestPath);
      payload = JSON.parse(raw) as McpInvocationRequest;
    } catch (err) {
      await this.writeResponse(responsePath, {
        success: false,
        error: {
          message: `Failed to parse MCP request: ${(err as Error).message}`,
          type: "ParseError",
        },
      });
      await this.sandbox.files.remove(requestPath).catch(() => {});
      return;
    }

    const response = await this.invokeTool(payload);
    await this.writeResponse(responsePath, response);
    await this.sandbox.files.remove(requestPath).catch(() => {});
  }

  private async invokeTool(
    payload: McpInvocationRequest,
  ): Promise<McpInvocationResponse> {
    const manager = MCPManagerSingleton.getInstance();
    const connection = manager.connections.get(payload.serverId);
    if (!connection) {
      return {
        success: false,
        error: {
          message: `MCP server ${payload.serverId} is not connected`,
          type: "ServerUnavailable",
        },
      };
    }

    try {
      const result = await connection.client.callTool(
        {
          name: payload.toolName,
          arguments: payload.args ?? {},
        },
        CallToolResultSchema,
        {
          timeout: connection.options.timeout,
        },
      );
      return {
        success: true,
        result,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        error: {
          message: error.message || "Failed to invoke MCP tool",
          type: error.name || "McpToolError",
        },
      };
    }
  }

  private async writeResponse(
    responsePath: string,
    response: McpInvocationResponse,
  ) {
    await this.sandbox.files.write(responsePath, JSON.stringify(response));
  }
}

type McpInvocationRequest = {
  id: string;
  serverId: string;
  toolName: string;
  args: Record<string, unknown>;
};

type McpInvocationResponse =
  | { success: true; result: unknown }
  | {
      success: false;
      error: {
        message: string;
        type?: string;
      };
    };

type LspInvocationRequest = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
};

type LspInvocationResponse =
  | { success: true; result: unknown }
  | {
      success: false;
      error: {
        message: string;
        type?: string;
      };
    };

class LspRequestMonitor {
  private stopped = false;
  private loopPromise: Promise<void> | null = null;
  private lspBridge: LspMcpBridge;

  constructor(
    private readonly sandbox: Sandbox,
    ide: IDE,
  ) {
    this.lspBridge = new LspMcpBridge(ide);
  }

  start() {
    if (this.loopPromise) {
      return;
    }
    this.stopped = false;
    this.loopPromise = this.loop();
  }

  async stop() {
    this.stopped = true;
    if (this.loopPromise) {
      try {
        await this.loopPromise;
      } catch {
        // ignore
      }
      this.loopPromise = null;
    }
  }

  private async loop() {
    while (!this.stopped) {
      try {
        await this.processOnce();
      } catch {
        // ignore
      }
      await delay(LSP_POLL_INTERVAL_MS);
    }
  }

  private async processOnce() {
    let entries;
    try {
      entries = await this.sandbox.files.list(LSP_REQUEST_DIR);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.type !== "file") {
        continue;
      }
      await this.handleRequest(entry.path);
    }
  }

  private async handleRequest(requestPath: string) {
    const fileName = path.posix.basename(requestPath);
    const responsePath = path.posix.join(LSP_RESPONSE_DIR, fileName);
    let payload: LspInvocationRequest | undefined;
    try {
      const raw = await this.sandbox.files.read(requestPath);
      payload = JSON.parse(raw) as LspInvocationRequest;
    } catch (err) {
      await this.writeResponse(responsePath, {
        success: false,
        error: {
          message: `Failed to parse LSP request: ${(err as Error).message}`,
          type: "ParseError",
        },
      });
      await this.sandbox.files.remove(requestPath).catch(() => {});
      return;
    }

    const response = await this.invokeTool(payload);
    await this.writeResponse(responsePath, response);
    await this.sandbox.files.remove(requestPath).catch(() => {});
  }

  private async invokeTool(
    payload: LspInvocationRequest,
  ): Promise<LspInvocationResponse> {
    try {
      const result = await this.lspBridge.callTool(
        payload.toolName,
        payload.args as Record<string, any>,
      );
      return {
        success: true,
        result,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        error: {
          message: error.message || "LSP invocation failed",
          type: error.name || "LspToolError",
        },
      };
    }
  }

  private async writeResponse(
    responsePath: string,
    response: LspInvocationResponse,
  ) {
    await this.sandbox.files.write(responsePath, JSON.stringify(response));
  }
}

class McpWrapperGenerator {
  async generate(ide: IDE) {
    const files: { path: string; content: string }[] = [];
    const serverExports: string[] = [];
    const usedSlugs = new Set<string>();

    // Add LSP as built-in virtual MCP server FIRST
    const lspFiles = this.generateLspWrappers();
    files.push(...lspFiles);
    serverExports.push(`export * as lsp from "./lsp/index.js";`);

    const manager = MCPManagerSingleton.getInstance();
    const statuses = manager.getStatuses();

    for (const status of statuses) {
      if (!status.client) {
        continue;
      }
      const slug = this.ensureUniqueSlug(
        usedSlugs,
        this.slugify(status.name ?? status.id ?? randomUUID()),
      );
      let tools: any[] = [];
      try {
        const toolsResponse = await status.client.listTools();
        tools = toolsResponse.tools ?? [];
      } catch (err) {
        console.error(`Failed to list tools for MCP server ${slug}:`, err);
        continue;
      }

      const toolExports: string[] = [];
      for (const tool of tools) {
        const filePath = `/mcp/${slug}/${tool.name}.ts`;
        const typeName = `${this.pascalCase(tool.name)}Args`;
        const typeDefinition = this.schemaToType(
          tool.inputSchema as JSONSchema7,
        );
        const fileContent = `type ${typeName} = ${typeDefinition};

export async function ${tool.name}(
  params: ${typeName} = {},
) {
  if (!globalThis.__mcp_invoke) {
    throw new Error("__mcp_invoke is unavailable in this sandbox");
  }
  return await globalThis.__mcp_invoke(
    ${JSON.stringify(status.id)},
    ${JSON.stringify(tool.name)},
    params,
  );
}
`;
        files.push({ path: filePath, content: fileContent });
        toolExports.push(`export * from "./${tool.name}";`);
      }

      const serverIndexPath = `/mcp/${slug}/index.ts`;
      files.push({
        path: serverIndexPath,
        content: toolExports.length ? toolExports.join("\n") : "export {};\n",
      });
      serverExports.push(`export * as ${slug} from "./${slug}";`);
    }

    files.push({
      path: `/mcp/index.ts`,
      content: serverExports.length ? serverExports.join("\n") : "export {};\n",
    });

    return files;
  }

  private generateLspWrappers(): { path: string; content: string }[] {
    const files: { path: string; content: string }[] = [];
    const toolExports: string[] = [];

    for (const tool of LSP_TOOLS) {
      const filePath = `/mcp/lsp/${tool.name}.ts`;
      const typeName = `${this.pascalCase(tool.name)}Args`;
      const typeDefinition = this.schemaToType(tool.inputSchema as JSONSchema7);

      const fileContent = `type ${typeName} = ${typeDefinition};

export async function ${tool.name}(
  params: ${typeName},
) {
  if (!globalThis.__lsp_invoke) {
    throw new Error("LSP is not available in this environment");
  }
  return await globalThis.__lsp_invoke(
    ${JSON.stringify(tool.name)},
    params,
  );
}
`;
      files.push({ path: filePath, content: fileContent });
      toolExports.push(`export * from "./${tool.name}.js";`);
    }

    // Create lsp/index.ts
    files.push({
      path: "/mcp/lsp/index.ts",
      content: toolExports.join("\n"),
    });

    return files;
  }

  private ensureUniqueSlug(used: Set<string>, slug: string) {
    let candidate = slug;
    let suffix = 1;
    while (used.has(candidate)) {
      candidate = `${slug}-${suffix++}`;
    }
    used.add(candidate);
    return candidate;
  }

  private slugify(name: string) {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-")
        .slice(0, 40) || "server"
    );
  }

  private pascalCase(name: string) {
    return name
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join("");
  }

  private schemaToType(schema?: JSONSchema7): string {
    if (!schema) {
      return "Record<string, unknown>";
    }

    if (schema.enum && schema.enum.length > 0) {
      return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
    }

    if (Array.isArray(schema.type)) {
      return schema.type
        .map((type) => this.schemaToType({ ...schema, type }))
        .join(" | ");
    }

    switch (schema.type) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "array": {
        const itemSchema = Array.isArray(schema.items)
          ? schema.items[0]
          : schema.items;
        // JSONSchema7Definition can be boolean (false means no items allowed)
        const itemType =
          typeof itemSchema === "boolean" || !itemSchema
            ? "unknown"
            : this.schemaToType(itemSchema);
        return `Array<${itemType}>`;
      }
      case "object": {
        const properties = schema.properties ?? {};
        const required = new Set(schema.required ?? []);
        const lines = Object.entries(properties).map(([key, prop]) => {
          const optional = required.has(key) ? "" : "?";
          return `${JSON.stringify(key)}${optional}: ${this.schemaToType(prop as JSONSchema7)};`;
        });
        if (schema.additionalProperties) {
          const additionalType =
            schema.additionalProperties === true
              ? "unknown"
              : this.schemaToType(schema.additionalProperties as JSONSchema7);
          lines.push(`[key: string]: ${additionalType};`);
        }
        if (!lines.length) {
          return "Record<string, unknown>";
        }
        return `{ ${lines.join(" ")} }`;
      }
      default:
        return "unknown";
    }
  }
}

const sessionManager = new SandboxSessionManager();

export const executeCodeImpl: ToolImpl = async (args, extras) => {
  const config = resolveCodeExecutionConfig(
    extras.config.experimental?.codeExecution,
  );

  if (!config.enabled) {
    throw new ContinueError(
      ContinueErrorReason.CodeExecutionDisabled,
      "Code execution is disabled. Enable it by setting experimental.codeExecution.enabled to true in your config.",
    );
  }

  const apiKey = config.e2bApiKey || process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new ContinueError(
      ContinueErrorReason.CodeExecutionMissingApiKey,
      "E2B API key required. Set experimental.codeExecution.e2bApiKey or the E2B_API_KEY environment variable. Get a key at https://e2b.dev/dashboard.",
    );
  }

  const code = getStringArg(args, "code");
  const languageArg =
    typeof args.language === "string"
      ? args.language.toLowerCase().trim()
      : "typescript";
  const language = LANGUAGE_MAP[languageArg] ?? LANGUAGE_MAP.typescript;
  if (!LANGUAGE_MAP[languageArg]) {
    throw new ContinueError(
      ContinueErrorReason.CodeExecutionUnsupportedLanguage,
      'Unsupported language. Use "typescript" (default) or "javascript".',
    );
  }

  const requestTimeoutMs = config.requestTimeoutSeconds * 1000;
  const session = await sessionManager.getSession(
    extras.conversationId,
    apiKey,
    requestTimeoutMs,
    config.sessionTimeoutMinutes,
    extras.ide,
  );

  executeCodePolicy.registerExecutionAttempt(
    extras.conversationId,
    config.rateLimit.maxExecutionsPerMinute,
  );

  const startedAt = Date.now();
  try {
    const execution = await session.sandbox.runCode(code, {
      language,
      timeoutMs: config.maxExecutionTimeSeconds * 1000,
      requestTimeoutMs,
    });
    session.lastUsed = Date.now();

    const stdout = execution.logs?.stdout?.join("\n") ?? "";
    const stderr = execution.logs?.stderr?.join("\n") ?? "";
    const resultText = stringifyResults(execution.results ?? []);
    const contextItems = buildContextItems(
      language,
      stdout,
      stderr,
      resultText,
      execution.error,
      config.maxOutputSizeChars,
    );

    void Telemetry.capture("execute_code_invoked", {
      conversationId: extras.conversationId ?? FALLBACK_CONVERSATION_ID,
      sandboxId: session.sandbox.sandboxId,
      duration_ms: Date.now() - startedAt,
      language,
      stdout_chars: stdout.length,
      stderr_chars: stderr.length,
      hasError: Boolean(execution.error),
    });

    return contextItems;
  } catch (err) {
    void Telemetry.capture("execute_code_failed", {
      conversationId: extras.conversationId ?? FALLBACK_CONVERSATION_ID,
      sandboxId: session.sandbox.sandboxId,
      errorType: (err as Error).name ?? "UnknownError",
      message: (err as Error).message,
    });
    throw err instanceof ContinueError
      ? err
      : new ContinueError(
          ContinueErrorReason.Unspecified,
          (err as Error).message || "Failed to execute code",
        );
  }
};

export const __TEST_ONLY = {
  clearSessions: () => sessionManager.clearAllSessions(),
};

function buildContextItems(
  language: string,
  stdout: string,
  stderr: string,
  resultText: string,
  executionError:
    | { name: string; value: string; traceback: string }
    | undefined,
  maxChars: number,
): ContextItem[] {
  const items: ContextItem[] = [];
  const summary = [
    `Language: ${language === "ts" ? "TypeScript" : "JavaScript"}`,
  ];
  items.push({
    name: "Code Execution Output",
    description: "Results from the E2B sandbox",
    content: `${summary.join("\n")}
\nStdout:\n${truncate(stdout, maxChars)}
\nStderr:\n${truncate(stderr, maxChars)}
\nResult:\n${truncate(resultText, maxChars)}`,
  });

  if (executionError) {
    items.push({
      name: executionError.name,
      description: "Execution error",
      content: truncate(
        `${executionError.value}\n\n${executionError.traceback}`,
        maxChars,
      ),
      icon: "problems",
    });
  }

  return items;
}

function truncate(value: string, maxChars: number) {
  if (!value) {
    return "";
  }
  if (value.length <= maxChars) {
    return value;
  }
  const half = Math.floor(maxChars / 2);
  return `${value.slice(0, half)}\n\n[truncated ${value.length - maxChars} chars]\n\n${value.slice(-half)}`;
}

function stringifyResults(results: any[]): string {
  if (!results || results.length === 0) {
    return "";
  }
  const texts = results
    .map((result) => {
      if (result.text) {
        return result.text;
      }
      if (result.data) {
        return JSON.stringify(result.data);
      }
      return "";
    })
    .filter(Boolean);

  return texts.join("\n\n");
}
