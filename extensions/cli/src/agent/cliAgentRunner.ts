/**
 * cliAgentRunner.ts — Phase 4: CLI adapter for core's AgentRunner.
 *
 * Provides runCliAgent() — a headless agent runner that delegates to
 * core/agent/AgentRunner.runAgent() while mapping:
 *   - BaseLlmApi + ModelConfig  →  ILLM  (via BaseLlmApiAdapter)
 *   - CLI Tool.run()            →  AgentRunConfig.dispatch (custom tool dispatcher)
 *   - AgentRunEvent             →  StreamCallbacks callbacks
 *
 * Permission checking is left to the caller (or the CLI's ToolPermissionService
 * before calling runCliAgent in headless flows where all approved tools are
 * already filtered by getAllAvailableTools).
 */

import type { ModelConfig } from "@yutoagentic/config-yaml";
import type { BaseLlmApi } from "@yutoagentic/openai-adapters";
import type {
  ChatMessage,
  ContextItem,
  ILLM,
  Tool as CoreTool,
  ToolCall as CoreToolCall,
  ToolExtras,
} from "core/index.js";
import {
  type AgentRunEvent,
  type AgentRunResult,
  runAgent,
} from "core/agent/AgentRunner.js";

import { getCliIde } from "../tools/coreToolBridge.js";
import { getAllAvailableTools } from "../tools/index.js";
import type { Tool as CliTool } from "../tools/types.js";
import type { StreamCallbacks } from "../stream/streamChatResponse.types.js";

import { BaseLlmApiAdapter } from "./cliLlmAdapter.js";

// ── Tool format conversion ────────────────────────────────────────────────────

/**
 * Convert a CLI Tool to the core Tool definition format expected by AgentRunner.
 * The schema metadata (name, description, parameters) is preserved; execution
 * is handled by the custom dispatch function below.
 */
function cliToCoreToolDef(cliTool: CliTool): CoreTool {
  return {
    type: "function",
    function: {
      name: cliTool.name,
      description: cliTool.description,
      parameters: cliTool.parameters,
    },
    displayTitle: cliTool.displayName,
    readonly: cliTool.readonly ?? false,
    group: "cli",
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CliAgentRunOptions {
  /** Initial user prompt. */
  prompt: string;
  /** Model configuration (provider, model name, contextLength, etc.). */
  model: ModelConfig;
  /** BaseLlmApi instance connected to the model. */
  llmApi: BaseLlmApi;
  /**
   * Whether to run in headless mode (auto-approve safe tools, skip interactive
   * permission dialogs).  Defaults to true.
   */
  isHeadless?: boolean;
  /** StreamCallbacks to receive real-time events from the agent loop. */
  callbacks?: StreamCallbacks;
  /** AbortController to cancel the run. */
  abortController?: AbortController;
  /** System message injected at position 0. */
  systemMessage?: string;
  /** Prior conversation to continue from (Continue ChatMessage format). */
  initialMessages?: ChatMessage[];
  /** Maximum agent turns before forced stop. */
  maxTurns?: number;
}

/**
 * Run the CLI agent using core's AgentRunner loop.
 *
 * Tool execution goes through each CLI tool's run() method so no duplicate
 * implementations are needed.  AgentRunEvents are mapped to StreamCallbacks
 * for UI/TUI consumers.
 */
export async function runCliAgent(
  options: CliAgentRunOptions,
): Promise<AgentRunResult> {
  const {
    prompt,
    model,
    llmApi,
    isHeadless = true,
    callbacks,
    abortController,
    systemMessage,
    initialMessages,
    maxTurns,
  } = options;

  // ── 1. Gather CLI tools ─────────────────────────────────────────────────
  const cliTools = await getAllAvailableTools(isHeadless);
  const cliToolsByName = new Map<string, CliTool>(
    cliTools.map((t) => [t.name, t]),
  );

  // Convert to core Tool format for the LLM's tool list
  const coreTools: CoreTool[] = cliTools.map(cliToCoreToolDef);

  // ── 2. Build ILLM adapter ────────────────────────────────────────────────
  const llm = new BaseLlmApiAdapter(llmApi, model) as unknown as ILLM;

  // ── 3. Custom tool dispatcher using CLI tool.run() ───────────────────────
  async function dispatch(
    _coreTool: CoreTool,
    toolCall: CoreToolCall,
    _extras: ToolExtras,
  ): Promise<{ errorMessage?: string; contextItems: ContextItem[] }> {
    const cliTool = cliToolsByName.get(toolCall.function.name);

    if (!cliTool) {
      return {
        errorMessage: `Tool not found: ${toolCall.function.name}`,
        contextItems: [],
      };
    }

    try {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const result = await cliTool.run(args);
      return {
        contextItems: [
          {
            content: result,
            name: cliTool.name,
            description: cliTool.description,
          },
        ],
      };
    } catch (err) {
      return {
        errorMessage: String(err),
        contextItems: [],
      };
    }
  }

  // ── 4. Map AgentRunEvent → StreamCallbacks ────────────────────────────────
  function onEvent(event: AgentRunEvent): void {
    switch (event.type) {
      case "chunk":
        if (typeof event.delta.content === "string" && event.delta.content) {
          callbacks?.onContent?.(event.delta.content);
        }
        break;

      case "tool_start":
        try {
          const toolArgs = JSON.parse(
            event.toolCall.function.arguments || "{}",
          );
          callbacks?.onToolStart?.(event.toolName, toolArgs);
        } catch {
          callbacks?.onToolStart?.(event.toolName, {});
        }
        break;

      case "tool_result":
        callbacks?.onToolResult?.(
          event.output.map((ci: ContextItem) => ci.content).join("\n\n"),
          event.toolCall.function.name,
          event.error ? "errored" : "done",
        );
        break;

      case "done":
        // No direct StreamCallbacks equivalent — caller gets the AgentRunResult
        break;
    }
  }

  // ── 5. Run the agent ─────────────────────────────────────────────────────
  const ide = getCliIde();

  return runAgent({
    prompt,
    llm,
    tools: coreTools,
    toolExtras: {
      ide,
      // llm is not used by the bridged tools; pass null safely
      llm: null as any,
      fetch: globalThis.fetch,
      config: {
        tools: coreTools,
        selectedModelByRole: { chat: null } as any,
        rules: [],
      } as any,
    },
    systemMessage,
    initialMessages,
    maxTurns,
    abortController,
    // Disable session memory — CLI manages its own session notes
    sessionMemory: false,
    dispatch,
    onEvent,
  });
}
