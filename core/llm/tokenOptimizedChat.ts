import {
  AssistantChatMessage,
  ChatMessage,
  ILLM,
  LLMFullCompletionOptions,
  PromptLog,
  ToolCallDelta,
} from "../index.js";
import { ShadowChatDb } from "../data/shadowChatDb.js";
import { SHADOW_TOOL_NAMES } from "../tools/builtIn.js";
import { shadowChatHistoryTools } from "../tools/definitions/shadowChatHistory.js";

interface CompletedToolCall {
  id: string;
  name: string;
  args: string;
}

function extractCompletedToolCalls(chunks: ChatMessage[]): CompletedToolCall[] {
  const callsById = new Map<string, CompletedToolCall>();
  const callOrder: string[] = [];
  let currentId = "";

  for (const chunk of chunks) {
    if (chunk.role !== "assistant" || !chunk.toolCalls?.length) continue;
    for (const delta of chunk.toolCalls as ToolCallDelta[]) {
      if (delta.id) {
        currentId = delta.id;
        if (!callsById.has(currentId)) {
          callsById.set(currentId, { id: currentId, name: "", args: "" });
          callOrder.push(currentId);
        }
      }
      if (!currentId) continue;
      const call = callsById.get(currentId);
      if (!call) continue;
      if (delta.function?.name) call.name += delta.function.name;
      if (delta.function?.arguments) call.args += delta.function.arguments;
    }
  }

  return callOrder.map((id) => callsById.get(id)!).filter((c) => c && c.name);
}

function extractUsageFromChunks(chunks: ChatMessage[]): {
  promptTokens: number;
  completionTokens: number;
} {
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk.role === "assistant" && chunk.usage) {
      return {
        promptTokens: chunk.usage.promptTokens,
        completionTokens: chunk.usage.completionTokens,
      };
    }
  }
  return { promptTokens: 0, completionTokens: 0 };
}

function buildTextContent(chunks: ChatMessage[]): string {
  return chunks
    .filter((c) => c.role === "assistant")
    .map((c) => (typeof c.content === "string" ? c.content : ""))
    .join("");
}

async function executeShadowTool(
  call: CompletedToolCall,
  sessionId: string,
  historyLimit: number,
): Promise<string> {
  try {
    const args = JSON.parse(call.args || "{}");

    if (call.name === "shadow_get_chat_history") {
      const limit: number =
        typeof args.limit === "number" ? args.limit : historyLimit;
      const history = await ShadowChatDb.getHistory(sessionId, limit);
      return JSON.stringify(history);
    }

    if (call.name === "shadow_search_messages") {
      const query: string = typeof args.query === "string" ? args.query : "";
      const limit: number = typeof args.limit === "number" ? args.limit : 10;
      const results = await ShadowChatDb.searchMessages(
        sessionId,
        query,
        limit,
      );
      return JSON.stringify(results);
    }

    if (call.name === "shadow_semantic_search") {
      const query: string = typeof args.query === "string" ? args.query : "";
      const limit: number = typeof args.limit === "number" ? args.limit : 10;
      const results = await ShadowChatDb.semanticSearch(
        sessionId,
        query,
        limit,
      );
      return JSON.stringify(results);
    }

    if (call.name === "shadow_get_conversation_stats") {
      const stats = await ShadowChatDb.getConversationStats(sessionId);
      const savingsPct =
        stats.totalEstimatedBaselineTokens > 0
          ? Math.round(
              (stats.totalTokensSaved / stats.totalEstimatedBaselineTokens) *
                100,
            )
          : 0;
      return JSON.stringify({ ...stats, savingsPercent: savingsPct });
    }

    if (call.name === "shadow_get_tool_result") {
      const toolName: string =
        typeof args.tool_name === "string" ? args.tool_name : "";
      const maxAgeTurns: number =
        typeof args.max_age_turns === "number" ? args.max_age_turns : 5;
      const cached = await ShadowChatDb.getToolResult(
        sessionId,
        toolName,
        maxAgeTurns,
      );
      if (cached === undefined) {
        return JSON.stringify({
          found: false,
          message: `No cached result found for tool '${toolName}' within the last ${maxAgeTurns} turns.`,
        });
      }
      return JSON.stringify({
        found: true,
        input: cached.inputArgs,
        result: cached.result,
      });
    }

    if (call.name === "shadow_search_all_sessions") {
      const query: string = typeof args.query === "string" ? args.query : "";
      const limit: number = typeof args.limit === "number" ? args.limit : 10;
      const results = await ShadowChatDb.searchAllSessions(query, limit);
      return JSON.stringify(results);
    }

    if (call.name === "shadow_semantic_search_all_sessions") {
      const query: string = typeof args.query === "string" ? args.query : "";
      const limit: number = typeof args.limit === "number" ? args.limit : 10;
      const results = await ShadowChatDb.semanticSearchAllSessions(
        query,
        limit,
      );
      return JSON.stringify(results);
    }

    return JSON.stringify({ error: `Unknown shadow tool: ${call.name}` });
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

export async function* tokenOptimizedStreamChat(
  model: ILLM,
  messages: ChatMessage[],
  signal: AbortSignal,
  options: LLMFullCompletionOptions,
  sessionId: string,
  historyLimit: number,
): AsyncGenerator<ChatMessage, PromptLog> {
  // Estimate baseline: what would have been sent without optimization
  const allText = messages
    .map((m) =>
      typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    )
    .join(" ");
  const estimatedBaselineTokens = Math.ceil(allText.length / 4);

  // Save the full incoming messages to DB (includes tool results from prior turns)
  await ShadowChatDb.saveMessages(sessionId, messages);

  // Extract the current user message and optional system message
  const systemMsg = messages.find((m) => m.role === "system");
  const currentUserMsg = [...messages].reverse().find((m) => m.role === "user");

  if (!currentUserMsg) {
    // Fallback: send messages as-is if no user message found
    yield* model.streamChat(messages, signal, options, { precompiled: true });
    return { modelTitle: "", modelProvider: "", prompt: "", completion: "" };
  }

  const userMessageText =
    typeof currentUserMsg.content === "string"
      ? currentUserMsg.content
      : JSON.stringify(currentUserMsg.content);

  // Shadow tools let the LLM pull history on demand instead of receiving it all
  // upfront. They're normally included via the client's active tool list, but
  // ultra mode's correctness depends on them always being present, so they're
  // force-included here regardless of the user's tool settings.
  const clientTools = options.tools ?? [];
  const missingShadowTools = shadowChatHistoryTools.filter(
    (st) => !clientTools.some((t) => t.function.name === st.function.name),
  );
  const augmentedOptions: LLMFullCompletionOptions = {
    ...options,
    tools: [...clientTools, ...missingShadowTools],
    shadowSessionId: sessionId,
  };

  let loopMessages: ChatMessage[] = [
    ...(systemMsg ? [systemMsg] : []),
    currentUserMsg,
  ];

  let totalActualTokensIn = 0;
  let totalActualTokensOut = 0;
  let finalPromptLog: PromptLog = {
    modelTitle: model.title ?? model.model,
    modelProvider: (model as any).providerName ?? "unknown",
    prompt: userMessageText,
    completion: "",
  };

  // Internal agentic loop: execute shadow_* tools server-side, pass external tools to client
  while (true) {
    const chunks: ChatMessage[] = [];
    const gen = model.streamChat(loopMessages, signal, augmentedOptions, {
      precompiled: true,
    });

    let next = await gen.next();
    while (!next.done) {
      chunks.push(next.value);
      next = await gen.next();
    }
    if (
      next.value &&
      typeof next.value === "object" &&
      "prompt" in next.value
    ) {
      finalPromptLog = next.value as PromptLog;
    }

    const { promptTokens, completionTokens } = extractUsageFromChunks(chunks);
    totalActualTokensIn += promptTokens;
    totalActualTokensOut += completionTokens;

    // Claude Code CLI (core/llm/llms/ClaudeCodeCli.ts) resolves its entire
    // tool-call loop internally, inside the single `claude -p` subprocess,
    // via shadow-code-tools MCP - including shadow_* history lookups. Any
    // toolCalls it yields here (paired with their results, for UI parity
    // with the normal provider path) are already-resolved history, not
    // pending work. Running the interception logic below would either
    // re-execute already-resolved shadow_* calls a second time, or spawn a
    // needless second `claude -p` process for calls that already have a
    // final answer - so always treat a single iteration as done.
    if (model.providerName === "claudecode") {
      for (const chunk of chunks) {
        yield chunk;
      }
      finalPromptLog = {
        ...finalPromptLog,
        completion: buildTextContent(chunks),
      };
      break;
    }

    const toolCalls = extractCompletedToolCalls(chunks);

    if (toolCalls.length === 0) {
      // Pure text response — stream all chunks to the caller
      for (const chunk of chunks) {
        yield chunk;
      }
      finalPromptLog = {
        ...finalPromptLog,
        completion: buildTextContent(chunks),
      };
      break;
    }

    const shadowCalls = toolCalls.filter((tc) =>
      SHADOW_TOOL_NAMES.has(tc.name),
    );
    const externalCalls = toolCalls.filter(
      (tc) => !SHADOW_TOOL_NAMES.has(tc.name),
    );

    if (externalCalls.length > 0) {
      // External/MCP tool calls — pass all chunks through to the client unchanged
      for (const chunk of chunks) {
        yield chunk;
      }
      break;
    }

    // All tool calls are shadow tools — execute server-side (never round-tripped
    // to the client, so the reduced-history guarantee holds), but still yield
    // the resolved call/result so the client renders the same tool-call card
    // it would for any other tool. Since this is followed by more streamed
    // chunks from the next loop iteration (ending in plain text), the client's
    // "pending tool call" detection naturally treats it as already resolved
    // history rather than something it needs to execute itself.
    const assistantToolCallMsg: AssistantChatMessage = {
      role: "assistant",
      content: "",
      toolCalls: shadowCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.args },
      })),
    };
    loopMessages = [...loopMessages, assistantToolCallMsg];
    yield assistantToolCallMsg;

    const turnIndex = await ShadowChatDb.getCurrentTurnIndex(sessionId);
    for (const call of shadowCalls) {
      const result = await executeShadowTool(call, sessionId, historyLimit);
      const toolResultMsg: ChatMessage = {
        role: "tool",
        content: result,
        toolCallId: call.id,
      };
      loopMessages = [...loopMessages, toolResultMsg];
      yield toolResultMsg;

      await ShadowChatDb.saveToolCall(
        sessionId,
        call.name,
        call.id,
        call.args,
        result,
        turnIndex,
      );
    }
    // Loop: the LLM will now see the tool results and produce its final answer
  }

  // Log token savings for this turn
  await ShadowChatDb.saveTurn(
    sessionId,
    userMessageText,
    finalPromptLog.completion,
    totalActualTokensIn,
    totalActualTokensOut,
    estimatedBaselineTokens,
  );

  return finalPromptLog;
}
