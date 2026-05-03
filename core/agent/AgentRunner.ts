/**
 * AgentRunner — autonomous execution loop for Continue.
 *
 * Architectural blueprint ported from Marcel (Yuto Code) QueryEngine.ts.
 * Uses Continue's existing callTool / streamChat / ILLM infrastructure.
 *
 * Loop: PLAN → ACT (stream LLM) → PARSE tool calls → VALIDATE →
 *        EXECUTE tools (concurrent read / serial write) → OBSERVE →
 *        APPEND → CHECK stop conditions → repeat
 */

import { v4 as uuidv4 } from "uuid";
import {
  AssistantChatMessage,
  ChatMessage,
  ContextItem,
  ILLM,
  Tool,
  ToolCall,
  ToolResultChatMessage,
} from "..";
import { callTool } from "../tools/callTool";
import { ToolExtras } from ".."
import {
  createDenialTrackingState,
  DenialTrackingState,
  recordDenial,
  recordSuccess,
  shouldFallbackToPrompting,
} from "../tools/policies/denialTracking";
import {
  createTaskStateBase,
  generateTaskId,
  TaskStateBase,
  TaskStatus,
  transitionTask,
} from "./TaskState";
import {
  createSessionMemoryState,
  extractSessionMemory,
  SessionMemoryConfig,
  SessionMemoryState,
  shouldExtractSessionMemory,
} from "./SessionMemory";
import { scheduleAutoDream } from "./autoDream";

// ─── Constants (mirrored from Marcel) ────────────────────────────────────────

const DEFAULT_MAX_TURNS = 50;
const DEFAULT_MAX_TOOL_ERRORS = 5;
const MAX_CONCURRENT_TOOLS = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentStopReason =
  | "done" // model returned no tool calls
  | "max_turns" // hit the turn limit
  | "error_limit" // too many consecutive tool errors
  | "aborted" // abort signal fired
  | "needs_clarification"; // denial tracking triggered fallback

export type AgentRunEvent =
  | { type: "turn_start"; turn: number; messages: ChatMessage[] }
  | { type: "chunk"; delta: ChatMessage }
  | { type: "tool_start"; toolCall: ToolCall; toolName: string }
  | { type: "tool_result"; toolCall: ToolCall; output: ContextItem[]; error?: string }
  | { type: "done"; stopReason: AgentStopReason; totalTurns: number };

export type AgentRunConfig = {
  /** Initial user prompt */
  prompt: string;
  /** LLM to use for the agent */
  llm: ILLM;
  /** Available tools — pulled from config in core.ts */
  tools: Tool[];
  /** Extras passed through to callTool (ide, fetch, config, etc.) */
  toolExtras: Omit<ToolExtras, "tool" | "toolCallId">;
  /** System message injected at position 0 */
  systemMessage?: string;
  /** Prior conversation to continue from */
  initialMessages?: ChatMessage[];
  /** Maximum agent turns before forced stop */
  maxTurns?: number;
  /** Maximum consecutive tool errors before stop */
  maxToolErrors?: number;
  /** Abort controller — wire to user cancel button */
  abortController?: AbortController;
  /** Called with every streamed event for real-time UI updates */
  onEvent?: (event: AgentRunEvent) => void;
  /** Enable session memory extraction (background notes-file updates) */
  sessionMemory?: Partial<SessionMemoryConfig> | false;
};

export type AgentRunResult = {
  sessionId: string;
  messages: ChatMessage[];
  stopReason: AgentStopReason;
  totalTurns: number;
  task: TaskStateBase;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract tool calls from an accumulated assistant message */
function extractToolCalls(msg: AssistantChatMessage): ToolCall[] {
  if (!msg.toolCalls || msg.toolCalls.length === 0) return [];

  return msg.toolCalls
    .filter(
      (tc): tc is Required<typeof tc> =>
        !!tc.id && !!tc.function?.name && tc.function?.arguments !== undefined,
    )
    .map((tc) => ({
      id: tc.id!,
      type: "function" as const,
      function: {
        name: tc.function!.name!,
        arguments: tc.function!.arguments ?? "{}",
      },
    }));
}

/** Resolve a Tool from the available tools list by name */
function resolveTool(tools: Tool[], name: string): Tool | undefined {
  return tools.find((t) => t.function.name === name);
}

/**
 * Partition tool calls into batches.
 * Read-only (tool.readonly === true) tool calls can run concurrently.
 * Write operations run serially.
 */
type ToolBatch = { concurrent: boolean; calls: ToolCall[] };

function partitionToolCalls(toolCalls: ToolCall[], tools: Tool[]): ToolBatch[] {
  return toolCalls.reduce<ToolBatch[]>((batches, call) => {
    const tool = resolveTool(tools, call.function.name);
    const isReadOnly = tool?.readonly === true;

    const last = batches[batches.length - 1];
    if (isReadOnly && last?.concurrent) {
      // Append to current read-only batch
      last.calls.push(call);
    } else {
      batches.push({ concurrent: isReadOnly, calls: [call] });
    }
    return batches;
  }, []);
}

/**
 * Execute a single tool call and return a ToolResultChatMessage.
 */
async function executeOneToolCall(
  toolCall: ToolCall,
  tools: Tool[],
  extras: Omit<ToolExtras, "tool" | "toolCallId">,
  onEvent?: AgentRunConfig["onEvent"],
): Promise<{ message: ToolResultChatMessage; error?: string }> {
  const tool = resolveTool(tools, toolCall.function.name);

  onEvent?.({ type: "tool_start", toolCall, toolName: toolCall.function.name });

  if (!tool) {
    const error = `Tool "${toolCall.function.name}" not found`;
    onEvent?.({ type: "tool_result", toolCall, output: [], error });
    return {
      message: {
        role: "tool",
        toolCallId: toolCall.id,
        content: error,
      },
      error,
    };
  }

  const fullExtras: ToolExtras = {
    ...extras,
    tool,
    toolCallId: toolCall.id,
  };

  const result = await callTool(tool, toolCall, fullExtras);

  const outputText = result.errorMessage
    ? `Error: ${result.errorMessage}`
    : result.contextItems.map((ci) => ci.content).join("\n\n");

  onEvent?.({
    type: "tool_result",
    toolCall,
    output: result.contextItems,
    error: result.errorMessage,
  });

  return {
    message: {
      role: "tool",
      toolCallId: toolCall.id,
      content: outputText,
    },
    error: result.errorMessage,
  };
}

/**
 * Execute a batch of tool calls — concurrently if the batch is marked safe,
 * serially otherwise. Respects MAX_CONCURRENT_TOOLS.
 */
async function executeBatch(
  batch: ToolBatch,
  tools: Tool[],
  extras: Omit<ToolExtras, "tool" | "toolCallId">,
  onEvent?: AgentRunConfig["onEvent"],
): Promise<{ messages: ToolResultChatMessage[]; errors: string[] }> {
  const messages: ToolResultChatMessage[] = [];
  const errors: string[] = [];

  if (batch.concurrent) {
    // Chunk into MAX_CONCURRENT_TOOLS-sized groups to avoid overwhelming the system
    for (
      let i = 0;
      i < batch.calls.length;
      i += MAX_CONCURRENT_TOOLS
    ) {
      const chunk = batch.calls.slice(i, i + MAX_CONCURRENT_TOOLS);
      const results = await Promise.all(
        chunk.map((call) => executeOneToolCall(call, tools, extras, onEvent)),
      );
      for (const r of results) {
        messages.push(r.message);
        if (r.error) errors.push(r.error);
      }
    }
  } else {
    // Serial execution
    for (const call of batch.calls) {
      const r = await executeOneToolCall(call, tools, extras, onEvent);
      messages.push(r.message);
      if (r.error) errors.push(r.error);
    }
  }

  return { messages, errors };
}

// ─── Main runner ──────────────────────────────────────────────────────────────

/**
 * Run the agent loop autonomously until a stop condition is met.
 * Returns the full message history and a stop reason.
 */
export async function runAgent(config: AgentRunConfig): Promise<AgentRunResult> {
  const {
    prompt,
    llm,
    tools,
    toolExtras,
    systemMessage,
    initialMessages = [],
    maxTurns = DEFAULT_MAX_TURNS,
    maxToolErrors = DEFAULT_MAX_TOOL_ERRORS,
    abortController = new AbortController(),
    onEvent,
    sessionMemory: sessionMemoryConfig,
  } = config;

  const sessionId = uuidv4();
  const taskId = generateTaskId("local_agent");
  let task = createTaskStateBase(taskId, "local_agent", prompt);
  task = transitionTask(task, "running");

  // Session memory state — only active when sessionMemory !== false
  let smState: SessionMemoryState | null =
    sessionMemoryConfig === false
      ? null
      : createSessionMemoryState(
          sessionId,
          sessionMemoryConfig ?? undefined,
        );

  // Build initial message history
  const messages: ChatMessage[] = [
    ...(systemMessage
      ? [{ role: "system" as const, content: systemMessage }]
      : []),
    ...initialMessages,
    { role: "user" as const, content: prompt },
  ];

  let denial: DenialTrackingState = createDenialTrackingState();
  let consecutiveToolErrors = 0;
  let turn = 0;
  let stopReason: AgentStopReason = "done";

  try {
    while (turn < maxTurns) {
      if (abortController.signal.aborted) {
        stopReason = "aborted";
        break;
      }

      turn++;
      onEvent?.({ type: "turn_start", turn, messages: [...messages] });

      // ── 1. Stream LLM turn ──────────────────────────────────────────────────
      const accumulated: AssistantChatMessage = {
        role: "assistant",
        content: "",
        toolCalls: [],
      };

      const stream = llm.streamChat(
        messages,
        abortController.signal,
        { tools },
      );

      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          stopReason = "aborted";
          break;
        }
        onEvent?.({ type: "chunk", delta: chunk });

        // Accumulate content
        if (typeof chunk.content === "string") {
          accumulated.content =
            (typeof accumulated.content === "string"
              ? accumulated.content
              : "") + chunk.content;
        }

        // Accumulate tool call deltas
        if (
          chunk.role === "assistant" &&
          chunk.toolCalls &&
          chunk.toolCalls.length > 0
        ) {
          for (const delta of chunk.toolCalls) {
            if (!delta.id) continue;

            let existing = accumulated.toolCalls!.find(
              (tc) => tc.id === delta.id,
            );
            if (!existing) {
              existing = { id: delta.id, type: "function", function: { name: "", arguments: "" } };
              accumulated.toolCalls!.push(existing);
            }
            if (delta.function?.name) {
              existing.function = existing.function ?? {};
              existing.function.name =
                (existing.function.name ?? "") + delta.function.name;
            }
            if (delta.function?.arguments !== undefined) {
              existing.function = existing.function ?? {};
              existing.function.arguments =
                (existing.function.arguments ?? "") + delta.function.arguments;
            }
          }
        }
      }

      if (stopReason === "aborted") break;

      messages.push(accumulated);

      // ── 2. Extract tool calls ───────────────────────────────────────────────
      const toolCalls = extractToolCalls(accumulated);

      if (toolCalls.length === 0) {
        // Model returned no tool calls → task complete
        stopReason = "done";
        break;
      }

      // ── 3. Check denial state ───────────────────────────────────────────────
      if (shouldFallbackToPrompting(denial)) {
        stopReason = "needs_clarification";
        break;
      }

      // ── 4. Partition & execute tool calls ────────────────────────────────────
      const batches = partitionToolCalls(toolCalls, tools);
      const toolResultMessages: ToolResultChatMessage[] = [];
      let batchErrors: string[] = [];

      for (const batch of batches) {
        if (abortController.signal.aborted) {
          stopReason = "aborted";
          break;
        }
        const batchResult = await executeBatch(batch, tools, toolExtras, onEvent);
        toolResultMessages.push(...batchResult.messages);
        batchErrors = batchErrors.concat(batchResult.errors);
      }

      if (stopReason === "aborted") break;

      // ── 5. Update denial and error tracking ─────────────────────────────────
      if (batchErrors.length > 0) {
        consecutiveToolErrors += batchErrors.length;
        denial = recordDenial(denial);
      } else {
        consecutiveToolErrors = 0;
        denial = recordSuccess(denial);
      }

      if (consecutiveToolErrors >= maxToolErrors) {
        stopReason = "error_limit";
        break;
      }

      // ── 6. Append tool results to conversation ───────────────────────────────
      for (const msg of toolResultMessages) {
        messages.push(msg);
      }

      // ── 7. Session memory extraction (background, non-blocking) ─────────────
      if (smState && shouldExtractSessionMemory(smState, messages)) {
        smState = await extractSessionMemory(smState, messages, llm);
      }
    }

    if (turn >= maxTurns && stopReason === "done") {
      stopReason = "max_turns";
    }
  } catch (err) {
    stopReason = "error_limit";
    task = transitionTask(task, "failed");
    throw err;
  }

  const finalStatus: TaskStatus =
    stopReason === "done" ? "completed" : stopReason === "aborted" ? "killed" : "failed";

  task = transitionTask(task, finalStatus);

  onEvent?.({ type: "done", stopReason, totalTurns: turn });

  // Schedule background cross-session memory consolidation (fire-and-forget).
  // Uses the same LLM as the session. Only fires when gates pass (time + sessions).
  if (sessionMemoryConfig !== false) {
    scheduleAutoDream(llm, sessionMemoryConfig ?? undefined);
  }

  return {
    sessionId,
    messages,
    stopReason,
    totalTurns: turn,
    task,
  };
}
