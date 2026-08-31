import { randomUUID } from "node:crypto";

import {
  ChatMessage,
  ContinueConfig,
  IDE,
  ILLM,
  Tool,
  ToolApprovalRequest,
  ToolCall,
  ToolCallDelta,
  ToolExtras,
} from "..";
import { SUBAGENT_MAX_ITERATIONS } from "../tools/constants";
import { BuiltInToolNames, SHADOW_TOOL_NAMES } from "../tools/builtIn";
import { callTool } from "../tools/callTool";
import { renderContextItems } from "../util/messageContent";
import { subagentSystemMessage } from "./subagentSystemMessage";

export interface SubagentTask {
  description: string;
  prompt: string;
  allowed_tools?: string[];
  model?: string;
}

export type SubagentStatus = "running" | "done" | "errored" | "canceled";

export interface SubagentProgress {
  status: SubagentStatus;
  /** Model round-trips completed so far. */
  iterations: number;
  /** Markdown transcript shown when the user expands this subagent's card. */
  transcript: string;
  /** The final report; only meaningful once status is "done". */
  report?: string;
}

export interface RunSubagentOptions {
  task: SubagentTask;
  llm: ILLM;
  config: ContinueConfig;
  ide: IDE;
  fetch: ToolExtras["fetch"];
  codeBaseIndexer?: ToolExtras["codeBaseIndexer"];
  /** Parent conversation id, for tool-result bookkeeping. */
  sessionId?: string;
  signal?: AbortSignal;
  requestApproval?: ToolExtras["requestApproval"];
  onProgress?: (progress: SubagentProgress) => void;
}

/**
 * Tools a subagent may use when the task didn't name any. Read-only tools only:
 * subagents run concurrently, so anything that writes could collide with a
 * sibling. `spawn_subagents` is excluded here AND independently by the depth
 * guard in its implementation, and the shadow_* tools are excluded because a
 * subagent has no conversation history of its own to search.
 */
export function resolveSubagentTools(
  config: ContinueConfig,
  allowedToolNames?: string[],
): Tool[] {
  const selectable = config.tools.filter(
    (t) =>
      t.function.name !== BuiltInToolNames.SpawnSubagents &&
      !SHADOW_TOOL_NAMES.has(t.function.name),
  );

  if (allowedToolNames?.length) {
    const requested = new Set(allowedToolNames);
    return selectable.filter((t) => requested.has(t.function.name));
  }

  return selectable.filter((t) => t.readonly);
}

/**
 * Resolves a task's optional `model` against the configured chat models. Falls
 * back to the parent's model rather than erroring: a mistyped name should
 * degrade to "same model as the main chat", not fail the whole task.
 */
export function resolveSubagentModel(
  config: ContinueConfig,
  fallback: ILLM,
  modelName?: string,
): ILLM {
  if (!modelName) {
    return fallback;
  }
  const candidates = config.modelsByRole?.chat ?? [];
  return (
    candidates.find((m) => m.model === modelName || m.title === modelName) ??
    fallback
  );
}

function toolCallsFromChunks(chunks: ChatMessage[]): ToolCall[] {
  const calls = new Map<
    string | number,
    { id: string; name: string; args: string }
  >();
  const order: (string | number)[] = [];
  let currentKey: string | number | undefined;

  for (const chunk of chunks) {
    if (chunk.role !== "assistant" || !chunk.toolCalls?.length) continue;
    for (const delta of chunk.toolCalls as ToolCallDelta[]) {
      const key =
        typeof delta.index === "number"
          ? delta.index
          : (delta.id ?? currentKey);
      if (key === undefined) continue;
      currentKey = key;

      let call = calls.get(key);
      if (!call) {
        call = { id: delta.id ?? "", name: "", args: "" };
        calls.set(key, call);
        order.push(key);
      }
      if (delta.id && !call.id) call.id = delta.id;
      if (delta.function?.name) call.name += delta.function.name;
      if (delta.function?.arguments) call.args += delta.function.arguments;
    }
  }

  return order
    .map((key) => calls.get(key)!)
    .filter((c) => c.name)
    .map((c) => ({
      id: c.id || randomUUID(),
      type: "function" as const,
      function: { name: c.name, arguments: c.args || "{}" },
    }));
}

function textFromChunks(chunks: ChatMessage[]): string {
  return chunks
    .filter((c) => c.role === "assistant" && typeof c.content === "string")
    .map((c) => c.content as string)
    .join("");
}

/**
 * Runs one subagent to completion and returns its report.
 *
 * Two execution modes. For providers we drive ourselves this is a bounded
 * tool-calling loop. For `claudecode` it is a single call: that provider only
 * ever forwards `[systemMessage, lastUserMessage]` to the CLI and discards the
 * rest, so iterating against it would silently lose the subagent's own tool
 * results between turns. The CLI runs its own loop against our MCP server
 * instead, which is the same arrangement the main chat already uses.
 */
export async function runSubagent(
  options: RunSubagentOptions,
): Promise<SubagentProgress> {
  const {
    task,
    config,
    ide,
    fetch,
    codeBaseIndexer,
    sessionId,
    signal,
    requestApproval,
    onProgress,
  } = options;

  const llm = resolveSubagentModel(config, options.llm, task.model);
  const tools = resolveSubagentTools(config, task.allowed_tools);
  const agentRunId = `subagent-${randomUUID()}`;

  const lines: string[] = [];
  let iterations = 0;

  const emit = (status: SubagentStatus, report?: string) => {
    const progress: SubagentProgress = {
      status,
      iterations,
      transcript: lines.join("\n"),
      report,
    };
    onProgress?.(progress);
    return progress;
  };

  const canceled = () => {
    lines.push("\n_Canceled._");
    return emit("canceled");
  };

  if (signal?.aborted) {
    return canceled();
  }

  const messages: ChatMessage[] = [
    { role: "system", content: subagentSystemMessage(tools) },
    { role: "user", content: task.prompt },
  ];

  const completionOptions = {
    tools,
    agentRunId,
    agentLabel: task.description,
    shadowSessionId: sessionId,
  };

  // Never let one subagent's failure take down the whole spawn call.
  try {
    if (llm.providerName === "claudecode") {
      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        messages,
        signal ?? new AbortController().signal,
        completionOptions,
      )) {
        chunks.push(chunk);
        if (chunk.role === "assistant" && chunk.toolCalls?.length) {
          for (const tc of chunk.toolCalls as ToolCallDelta[]) {
            if (tc.function?.name) {
              lines.push(`- \`${tc.function.name}\``);
            }
          }
          emit("running");
        }
      }
      if (signal?.aborted) {
        return canceled();
      }
      const report = textFromChunks(chunks).trim();
      lines.push(report);
      return emit("done", report);
    }

    while (iterations < SUBAGENT_MAX_ITERATIONS) {
      if (signal?.aborted) {
        return canceled();
      }
      iterations += 1;

      const chunks: ChatMessage[] = [];
      for await (const chunk of llm.streamChat(
        messages,
        signal ?? new AbortController().signal,
        completionOptions,
      )) {
        chunks.push(chunk);
      }

      if (signal?.aborted) {
        return canceled();
      }

      const text = textFromChunks(chunks).trim();
      const toolCalls = toolCallsFromChunks(chunks);

      if (text) {
        lines.push(text);
      }

      if (toolCalls.length === 0) {
        return emit("done", text);
      }

      messages.push({
        role: "assistant",
        content: text,
        toolCalls,
      });
      emit("running");

      // Sequential, not parallel: a subagent's own calls are usually dependent
      // reads, and serializing them keeps approval prompts in a sane order.
      for (const toolCall of toolCalls) {
        if (signal?.aborted) {
          return canceled();
        }

        const resultText = await executeSubagentToolCall({
          toolCall,
          tools,
          config,
          ide,
          llm,
          fetch,
          codeBaseIndexer,
          sessionId,
          signal,
          requestApproval,
          agentLabel: task.description,
          onLine: (line) => lines.push(line),
        });

        messages.push({
          role: "tool",
          content: resultText,
          toolCallId: toolCall.id,
        });
      }

      emit("running");
    }

    // Ran out of iterations. Report what we have rather than nothing.
    const partial = lines.join("\n");
    lines.push(
      `\n_Stopped after ${SUBAGENT_MAX_ITERATIONS} iterations without reaching a conclusion._`,
    );
    return emit(
      "done",
      `${partial}\n\n(This subagent hit its ${SUBAGENT_MAX_ITERATIONS}-iteration limit before finishing. The above is incomplete.)`,
    );
  } catch (e) {
    if (signal?.aborted) {
      return canceled();
    }
    const message = e instanceof Error ? e.message : String(e);
    lines.push(`\n**Error:** ${message}`);
    return emit("errored", `This subagent failed: ${message}`);
  }
}

async function executeSubagentToolCall(params: {
  toolCall: ToolCall;
  tools: Tool[];
  config: ContinueConfig;
  ide: IDE;
  llm: ILLM;
  fetch: ToolExtras["fetch"];
  codeBaseIndexer?: ToolExtras["codeBaseIndexer"];
  sessionId?: string;
  signal?: AbortSignal;
  requestApproval?: ToolExtras["requestApproval"];
  agentLabel: string;
  onLine: (line: string) => void;
}): Promise<string> {
  const { toolCall, tools, agentLabel, onLine } = params;
  const name = toolCall.function.name;

  const tool = tools.find((t) => t.function.name === name);
  if (!tool) {
    onLine(`- \`${name}\` — not available to this subagent`);
    return `Tool "${name}" is not available to you. Use only the tools listed in your instructions.`;
  }

  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
  } catch {
    // Leave empty; the tool's own arg validation will produce the error.
  }

  // Subagent tool calls bypass the GUI's streaming loop, so they'd otherwise
  // skip the policy gate entirely - Core executes tools unconditionally.
  if (params.requestApproval) {
    const approval: ToolApprovalRequest = {
      approvalId: randomUUID(),
      toolCallId: toolCall.id,
      sessionId: params.sessionId,
      toolName: name,
      args: parsedArgs,
      displayTitle: tool.displayTitle,
      wouldLikeTo: tool.wouldLikeTo,
      agentLabel,
    };
    const { approved } = await params.requestApproval(approval);
    if (!approved) {
      onLine(`- \`${name}\` — denied by user`);
      return `The user denied this tool call. Do not retry it; work with what you have or explain what you could not determine.`;
    }
  }

  const { contextItems, errorMessage } = await callTool(tool, toolCall, {
    config: params.config,
    ide: params.ide,
    llm: params.llm,
    fetch: params.fetch,
    tool,
    toolCallId: toolCall.id,
    codeBaseIndexer: params.codeBaseIndexer,
    sessionId: params.sessionId,
    signal: params.signal,
    requestApproval: params.requestApproval,
    // Everything a subagent calls runs at depth 1, which is what makes
    // spawn_subagents refuse to run from inside a subagent.
    subagentDepth: 1,
  });

  if (errorMessage) {
    onLine(`- \`${name}\` — error: ${errorMessage}`);
    return `Tool "${name}" failed: ${errorMessage}`;
  }

  onLine(`- \`${name}\``);
  return renderContextItems(contextItems) || "(no output)";
}
