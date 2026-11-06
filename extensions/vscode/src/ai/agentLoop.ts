import type { ChatMessage, ILLM, Tool, ToolResultChatMessage } from "core";
import { renderChatMessage } from "core/util/messageContent";

import { ToolCallCollector } from "./languageModelChatProvider";

/** Where the agent's output and tool calls go: VS Code's chat in practice. */
export interface AgentIO {
  markdown(text: string): void;
  progress(text: string): void;
  /** Run a tool (VS Code asks the user to confirm where its policy says so). */
  invokeTool(name: string, input: object): Promise<string>;
  isCancelled(): boolean;
  signal: AbortSignal;
}

export interface AgentTurn {
  llm: ILLM;
  systemMessage?: string;
  /** Earlier turns, oldest first. */
  history: ChatMessage[];
  prompt: string;
  tools: Tool[];
  maxSteps?: number;
}

/**
 * One user turn: stream the model's answer, run the tools it calls, feed the
 * results back, and repeat until it answers without calling a tool. Returns
 * the text it showed, for the session transcript.
 */
export async function runAgentTurn(
  turn: AgentTurn,
  io: AgentIO,
): Promise<string> {
  const messages: ChatMessage[] = [
    ...(turn.systemMessage
      ? [{ role: "system" as const, content: turn.systemMessage }]
      : []),
    ...turn.history,
    { role: "user", content: turn.prompt },
  ];
  let shown = "";
  const maxSteps = turn.maxSteps ?? 25;

  for (let step = 0; step < maxSteps; step++) {
    if (io.isCancelled()) break;
    const calls = new ToolCallCollector();
    let text = "";
    for await (const chunk of turn.llm.streamChat(messages, io.signal, {
      ...(turn.tools.length ? { tools: turn.tools } : {}),
    })) {
      if (io.isCancelled()) break;
      if (chunk.role !== "assistant") continue;
      const delta = renderChatMessage(chunk);
      if (delta) {
        text += delta;
        io.markdown(delta);
      }
      for (const d of chunk.toolCalls ?? []) calls.add(d);
    }
    shown += text;
    const toolCalls = calls.finish();
    messages.push({
      role: "assistant",
      content: text,
      ...(toolCalls.length
        ? {
            toolCalls: toolCalls.map((c) => ({
              id: c.id,
              type: "function" as const,
              function: { name: c.name, arguments: JSON.stringify(c.input) },
            })),
          }
        : {}),
    });
    if (toolCalls.length === 0 || io.isCancelled()) return shown;

    for (const call of toolCalls) {
      io.progress(`Running ${call.name}`);
      let result: string;
      try {
        result = await io.invokeTool(call.name, call.input);
      } catch (e) {
        // A refused or failed tool goes back to the model as its result.
        result = `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
      const toolMessage: ToolResultChatMessage = {
        role: "tool",
        toolCallId: call.id,
        content: result,
      };
      messages.push(toolMessage);
    }
    if (text) {
      io.markdown("\n\n");
      shown += "\n\n";
    }
  }
  if (!io.isCancelled()) {
    const note = `\n\n_Stopped after ${maxSteps} steps._`;
    io.markdown(note);
    shown += note;
  }
  return shown;
}
