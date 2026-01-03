import { randomUUID } from "node:crypto";
import path from "node:path";
import { createInterface } from "node:readline";

import type { ModelConfig } from "@continuedev/config-yaml";
import type { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem, Session } from "core/index.js";

import { processCommandFlags } from "../flags/flagProcessor.js";
import { safeStderr, safeStdout } from "../init.js";
import { logger } from "../util/logger.js";
import { initializeServices, services } from "../services/index.js";
import { serviceContainer } from "../services/ServiceContainer.js";
import { SERVICE_NAMES, ModelServiceState } from "../services/types.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";
import { StreamCallbacks } from "../stream/streamChatResponse.types.js";
import { toolPermissionManager } from "../permissions/permissionManager.js";
import { getVersion } from "../version.js";

import {
  ACP_PROTOCOL_VERSION,
  AcpContentBlock,
  buildToolTitle,
  convertPromptBlocks,
  getAcpToolKind,
  mapToolStatusToAcpStatus,
} from "./utils.js";
import type { AcpToolKind } from "./utils.js";

type JsonRpcId = number | string | null;

type JsonRpcRequest = {
  jsonrpc?: "2.0";
  id?: JsonRpcId;
  method?: unknown;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type SessionUpdate = {
  sessionUpdate: string;
  [key: string]: unknown;
};

type AcpSessionState = {
  sessionId: string;
  cwd: string;
  history: ChatHistoryItem[];
  turnInFlight: boolean;
  abortController: AbortController | null;
  cancelRequested: boolean;
};

export class ContinueAcpServer {
  private sessions = new Map<string, AcpSessionState>();
  private initialized = false;
  private servicesReady = false;
  private rootCwd: string | null = null;
  private activePromptSessionId: string | null = null;

  private model: ModelConfig | null = null;
  private llmApi: BaseLlmApi | null = null;

  constructor(private readonly options: Record<string, unknown> = {}) {}

  async run(): Promise<void> {
    const rl = createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
      terminal: false,
    });

    rl.on("line", (line) => {
      void this.handleLine(line);
    });

    await new Promise<void>((resolve) => {
      rl.on("close", resolve);
    });
  }

  private writeMessage(message: object): void {
    safeStdout(`${JSON.stringify(message)}\n`);
  }

  private writeError(
    id: JsonRpcId,
    code: number,
    message: string,
    data?: unknown,
  ): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data === undefined ? {} : { data }),
      },
    };
  }

  private writeOk(id: JsonRpcId, result: unknown): JsonRpcResponse {
    return { jsonrpc: "2.0", id, result };
  }

  private notifySessionUpdate(sessionId: string, update: SessionUpdate): void {
    this.writeMessage({
      jsonrpc: "2.0",
      method: "session/update",
      params: { sessionId, update },
    });
  }

  private async handleLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let parsed: JsonRpcRequest;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      this.writeMessage(this.writeError(null, -32700, "Parse error"));
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      this.writeMessage(this.writeError(null, -32600, "Invalid Request"));
      return;
    }

    if (typeof parsed.method !== "string") {
      return;
    }

    try {
      const response = await this.handleRequest(
        parsed.method,
        parsed.params,
        parsed.id,
      );
      if (response) {
        this.writeMessage(response);
      }
    } catch (error) {
      if (parsed.id === undefined) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.writeMessage(
        this.writeError(parsed.id, -32603, "Internal error", { message }),
      );
    }
  }

  private async handleRequest(
    method: string,
    params: unknown,
    id: JsonRpcId | undefined,
  ): Promise<JsonRpcResponse | null> {
    switch (method) {
      case "initialize":
        return this.handleInitialize(params, id);
      case "session/new":
        return this.handleSessionNew(params, id);
      case "session/prompt":
        return this.handleSessionPrompt(params, id);
      case "session/cancel":
        return this.handleSessionCancel(params, id);
      case "session/set_mode":
        return this.handleSessionSetMode(params, id);
      default:
        if (id === undefined) {
          return null;
        }
        return this.writeError(id, -32601, "Method not found");
    }
  }

  private handleInitialize(
    params: unknown,
    id: JsonRpcId | undefined,
  ): JsonRpcResponse | null {
    if (id === undefined) {
      return null;
    }

    this.initialized = true;

    return this.writeOk(id, {
      protocolVersion: ACP_PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
        promptCapabilities: {
          image: false,
          audio: false,
          embeddedContext: true,
        },
        mcpCapabilities: {
          http: false,
          sse: false,
        },
        sessionCapabilities: {},
      },
      agentInfo: {
        name: "continue-cli",
        title: "Continue CLI",
        version: getVersion(),
      },
      authMethods: [],
    });
  }

  private async handleSessionNew(
    params: unknown,
    id: JsonRpcId | undefined,
  ): Promise<JsonRpcResponse | null> {
    if (id === undefined) {
      return null;
    }
    if (!this.initialized) {
      return this.writeError(id, -32600, "Invalid Request", {
        message: "Must call initialize first",
      });
    }
    if (!params || typeof params !== "object") {
      return this.writeError(id, -32602, "Invalid params");
    }

    const { cwd, mcpServers } = params as {
      cwd?: string;
      mcpServers?: unknown[];
    };

    if (!cwd || typeof cwd !== "string") {
      return this.writeError(id, -32602, "Invalid params", {
        message: "`cwd` must be provided",
      });
    }
    if (!path.isAbsolute(cwd)) {
      return this.writeError(id, -32602, "Invalid params", {
        message: "`cwd` must be an absolute path",
      });
    }
    if (mcpServers !== undefined && !Array.isArray(mcpServers)) {
      return this.writeError(id, -32602, "Invalid params", {
        message: "`mcpServers` must be an array",
      });
    }

    const mcpServerList = Array.isArray(mcpServers) ? mcpServers : [];
    await this.ensureServicesInitialized(cwd);

    const sessionId = `sess_${randomUUID().replace(/-/g, "")}`;
    const session: AcpSessionState = {
      sessionId,
      cwd,
      history: [],
      turnInFlight: false,
      abortController: null,
      cancelRequested: false,
    };
    this.sessions.set(sessionId, session);

    if (mcpServerList.length > 0) {
      logger.debug("ACP mcpServers provided but ignored", {
        count: mcpServerList.length,
      });
    }

    await this.initializeSessionState(session);

    return this.writeOk(id, {
      sessionId,
      modes: this.getModeState(),
    });
  }

  private async handleSessionPrompt(
    params: unknown,
    id: JsonRpcId | undefined,
  ): Promise<JsonRpcResponse | null> {
    if (id === undefined) {
      return null;
    }
    if (!this.initialized) {
      return this.writeError(id, -32600, "Invalid Request", {
        message: "Must call initialize first",
      });
    }
    if (!params || typeof params !== "object") {
      return this.writeError(id, -32602, "Invalid params");
    }

    const { sessionId, prompt } = params as {
      sessionId?: string;
      prompt?: AcpContentBlock[];
    };

    if (!sessionId || typeof sessionId !== "string") {
      return this.writeError(id, -32602, "Invalid params", {
        message: "`sessionId` must be provided",
      });
    }

    if (!Array.isArray(prompt)) {
      return this.writeError(id, -32602, "Invalid params", {
        message: "`prompt` must be an array",
      });
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return this.writeError(id, -32002, "Resource not found", { sessionId });
    }

    if (this.activePromptSessionId && this.activePromptSessionId !== sessionId) {
      return this.writeError(id, -32000, "Server busy", {
        message: "Another session is currently processing a prompt",
      });
    }

    if (session.turnInFlight) {
      return this.writeError(id, -32000, "Prompt already in progress", {
        sessionId,
      });
    }

    await this.ensureServicesInitialized(session.cwd);

    const { text, contextItems } = convertPromptBlocks(prompt, session.cwd);
    if (!text && contextItems.length === 0) {
      return this.writeError(id, -32602, "Invalid params", {
        message: "Prompt contained no usable content",
      });
    }

    session.turnInFlight = true;
    session.cancelRequested = false;
    this.activePromptSessionId = sessionId;

    try {
      await this.initializeSessionState(session);
      services.chatHistory.addUserMessage(text, contextItems);

      const abortController = new AbortController();
      session.abortController = abortController;

      const callbacks: StreamCallbacks = {
        onContent: (content: string) => {
          if (!content) return;
          this.notifySessionUpdate(sessionId, {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: content },
          });
        },
        onToolCall: (toolCall) => {
          const title = buildToolTitle(toolCall.name, toolCall.arguments);
          const kind: AcpToolKind = getAcpToolKind(toolCall.name);
          this.notifySessionUpdate(sessionId, {
            sessionUpdate: "tool_call",
            toolCallId: toolCall.id,
            title,
            kind,
            status: "pending",
            rawInput: toolCall.arguments ?? {},
          });
        },
        onToolCallUpdate: (update) => {
          const status = mapToolStatusToAcpStatus(update.status);
          const content = update.output || update.error;
          const contentBlocks =
            content && typeof content === "string"
              ? [
                  {
                    type: "content",
                    content: { type: "text", text: content },
                  },
                ]
              : undefined;

          this.notifySessionUpdate(sessionId, {
            sessionUpdate: "tool_call_update",
            toolCallId: update.toolCallId,
            ...(status ? { status } : {}),
            ...(contentBlocks ? { content: contentBlocks } : {}),
            ...(update.output ? { rawOutput: { output: update.output } } : {}),
            ...(update.error ? { rawOutput: { error: update.error } } : {}),
          });
        },
        onToolPermissionRequest: (_toolName, _toolArgs, requestId) => {
          toolPermissionManager.approveRequest(requestId);
        },
      };

      if (!this.model || !this.llmApi) {
        throw new Error("Model services were not initialized");
      }

      await streamChatResponse(
        services.chatHistory.getHistory(),
        this.model,
        this.llmApi,
        abortController,
        callbacks,
      );

      session.history = services.chatHistory.getHistory();

      if (session.cancelRequested || abortController.signal.aborted) {
        return this.writeOk(id, { stopReason: "cancelled" });
      }

      return this.writeOk(id, { stopReason: "end_turn" });
    } catch (error) {
      if (
        session.cancelRequested ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        return this.writeOk(id, { stopReason: "cancelled" });
      }

      const message = error instanceof Error ? error.message : String(error);
      safeStderr(`ACP prompt error: ${message}\n`);
      return this.writeError(id, -32603, "Internal error", { message });
    } finally {
      session.turnInFlight = false;
      session.abortController = null;
      this.activePromptSessionId = null;
    }
  }

  private async handleSessionCancel(
    params: unknown,
    id: JsonRpcId | undefined,
  ): Promise<JsonRpcResponse | null> {
    const sessionId =
      params &&
      typeof params === "object" &&
      typeof (params as { sessionId?: string }).sessionId === "string"
        ? (params as { sessionId?: string }).sessionId
        : undefined;

    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.cancelRequested = true;
        if (session.abortController) {
          session.abortController.abort();
        }
      }
    }

    if (id === undefined) {
      return null;
    }
    return this.writeOk(id, null);
  }

  private async handleSessionSetMode(
    params: unknown,
    id: JsonRpcId | undefined,
  ): Promise<JsonRpcResponse | null> {
    if (id === undefined) {
      return null;
    }
    if (!params || typeof params !== "object") {
      return this.writeError(id, -32602, "Invalid params");
    }

    const { sessionId, modeId } = params as {
      sessionId?: string;
      modeId?: string;
    };

    if (!sessionId || typeof sessionId !== "string") {
      return this.writeError(id, -32602, "Invalid params", {
        message: "`sessionId` must be provided",
      });
    }
    if (!modeId || typeof modeId !== "string") {
      return this.writeError(id, -32602, "Invalid params", {
        message: "`modeId` must be provided",
      });
    }

    if (!this.sessions.has(sessionId)) {
      return this.writeError(id, -32002, "Resource not found", { sessionId });
    }

    const availableModes = this.getAvailableModes();
    if (!availableModes.some((mode) => mode.id === modeId)) {
      return this.writeError(id, -32602, "Invalid params", {
        message: `Unknown modeId "${modeId}"`,
      });
    }

    services.toolPermissions.switchMode(modeId as any);

    this.notifySessionUpdate(sessionId, {
      sessionUpdate: "current_mode_update",
      currentModeId: modeId,
    });

    return this.writeOk(id, {});
  }

  private getAvailableModes(): Array<{
    id: string;
    name: string;
    description: string;
  }> {
    return services.toolPermissions.getAvailableModes().map((mode) => ({
      id: mode.mode,
      name: mode.mode.charAt(0).toUpperCase() + mode.mode.slice(1),
      description: mode.description,
    }));
  }

  private getModeState() {
    const availableModes = this.getAvailableModes();
    const currentMode = services.toolPermissions.getCurrentMode();
    return {
      currentModeId: currentMode,
      availableModes,
    };
  }

  private async ensureServicesInitialized(cwd: string): Promise<void> {
    if (this.servicesReady) {
      if (this.rootCwd && path.resolve(cwd) !== this.rootCwd) {
        throw new Error(
          `ACP server already initialized for ${this.rootCwd}.`,
        );
      }
      return;
    }

    this.rootCwd = path.resolve(cwd);
    process.chdir(this.rootCwd);

    const options = { ...this.options } as Record<string, any>;
    if (!options.readonly) {
      options.auto = true;
    }
    const { permissionOverrides } = processCommandFlags(options);

    await initializeServices({
      options,
      headless: false,
      skipOnboarding: true,
      toolPermissionOverrides: permissionOverrides,
    });

    const modelState = await serviceContainer.get<ModelServiceState>(
      SERVICE_NAMES.MODEL,
    );

    if (!modelState.model || !modelState.llmApi) {
      throw new Error("No model or LLM API configured");
    }

    this.model = modelState.model;
    this.llmApi = modelState.llmApi;
    services.chatHistory.setRemoteMode(true);

    this.servicesReady = true;
  }

  private async initializeSessionState(
    session: AcpSessionState,
  ): Promise<void> {
    const snapshot: Session = {
      sessionId: session.sessionId,
      title: "ACP Session",
      workspaceDirectory: session.cwd,
      history: session.history,
      usage: {
        totalCost: 0,
        promptTokens: 0,
        completionTokens: 0,
        promptTokensDetails: {
          cachedTokens: 0,
          cacheWriteTokens: 0,
        },
      },
    };

    await services.chatHistory.initialize(snapshot, true);
  }
}
