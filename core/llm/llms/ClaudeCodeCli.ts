import { spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";

import {
  ChatMessage,
  CompletionOptions,
  ToolCallDelta,
  Usage,
} from "../../index.js";
import { getShadowCodeToolsMcpServer } from "../../mcp/shadowCodeToolsServer.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { deriveSessionId } from "../../util/shadowChatSessionId.js";
import { BaseLLM } from "../index.js";

const MCP_SERVER_NAME = "shadow-code";
const MCP_TOOL_PREFIX = `mcp__${MCP_SERVER_NAME}__`;

// Confirmed against a real `claude -p --output-format stream-json` run
// against a live MCP tool call (see conversation - not guessed).
interface StreamJsonEvent {
  type: string;
  subtype?: string;
  message?: {
    role?: string;
    content?: Array<
      | { type: "text"; text: string }
      | { type: "thinking"; thinking: string }
      | { type: "tool_use"; id: string; name: string; input: unknown }
      | {
          type: "tool_result";
          tool_use_id: string;
          content?: Array<{ type: "text"; text: string }> | string;
        }
    >;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

function toolResultText(
  content: Array<{ type: "text"; text: string }> | string | undefined,
): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
}

class ClaudeCodeCli extends BaseLLM {
  static providerName = "claudecode";

  // Reuses the same session identity the rest of the app already uses for
  // ShadowChatDb (core/util/shadowChatSessionId.ts, core/llm/streamChat.ts).
  // Continue's own real session id isn't available to LLM providers (every
  // provider is a stateless completion API from Continue's perspective), so
  // this is the correct id to key on regardless - it's what the shadow_*
  // tools below already search against for any provider.
  private async writeMcpConfig(sessionId: string): Promise<string> {
    const mcpServer = getShadowCodeToolsMcpServer();
    const url = await mcpServer.ensureStarted();
    const configPath = path.join(
      os.tmpdir(),
      `shadow-code-mcp-${sessionId}.json`,
    );
    await fs.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          [MCP_SERVER_NAME]: {
            type: "http",
            url: `${url}?continueSessionId=${encodeURIComponent(sessionId)}`,
          },
        },
      }),
    );
    return configPath;
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const systemMessage = messages.find((m) => m.role === "system");
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUserMessage) {
      throw new Error("ClaudeCodeCli requires at least one user message");
    }

    // No --session-id/--resume: each call is a genuinely fresh Claude Code
    // session. Continuity across turns isn't handled by Claude Code's own
    // session state - it's handled the same way every other provider in
    // this codebase handles it under Ultra Token Saving mode
    // (core/llm/tokenOptimizedChat.ts): earlier turns live in ShadowChatDb,
    // and the model pulls them back on demand via the shadow_* tools
    // (shadow_get_chat_history, shadow_search_messages, etc.).
    //
    // Prefer options.shadowSessionId (the id tokenOptimizedStreamChat
    // actually recorded this conversation's history under - Continue's real
    // GUI session id when available, not a content hash) over deriving one
    // ourselves. They'd disagree whenever a real session id exists, which is
    // the normal case, and shadow_get_chat_history would silently query an
    // empty session if we used the wrong one.
    const sessionId = options.shadowSessionId ?? deriveSessionId(messages);
    const mcpConfigPath = await this.writeMcpConfig(sessionId);

    // Expose exactly the tools active for this turn (options.tools already
    // includes any client tool overrides plus, under Ultra Token Saving
    // mode, the force-included shadow_* tools - see
    // tokenOptimizedChat.ts:augmentedOptions), not a static reload of the
    // full config. Registered/unregistered per call since this MCP server
    // is a shared, long-lived singleton serving every Continue session.
    const mcpServer = getShadowCodeToolsMcpServer();
    mcpServer.registerToolsForSession(sessionId, options.tools ?? []);

    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--mcp-config",
      mcpConfigPath,
      "--strict-mcp-config",
      "--allowedTools",
      `${MCP_TOOL_PREFIX}*`,
      // Disable Claude Code's entire built-in tool set (Read/Write/Edit/
      // Bash/...) - every tool call must go through shadow-code-tools MCP.
      "--tools",
      "",
      // Our own MCP server already gates every call through Continue's
      // approval/policy flow (see ShadowCodeToolsMcpServer + the
      // claudeCodeCli/authorizeToolCall round-trip to the GUI); Claude
      // Code's own permission layer has no terminal to prompt against in
      // -p mode and would otherwise just hang or auto-deny.
      "--permission-mode",
      "bypassPermissions",
    ];
    if (systemMessage) {
      // Full override, not append: Continue's own system prompt is the only
      // one in effect. (--bare would additionally strip CLAUDE.md/hooks/
      // memory, but it also forces API-key-only auth, which defeats the
      // whole point of running through a Pro/Max/Team subscription - so it
      // is deliberately NOT used here.)
      args.push("--system-prompt", renderChatMessage(systemMessage));
    }
    if (options.model) {
      args.push("--model", options.model);
    }

    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const onAbort = () => child.kill();
    signal.addEventListener("abort", onAbort);

    child.stdin.write(renderChatMessage(lastUserMessage));
    child.stdin.end();

    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    let buffer = "";
    let usage: Usage | undefined;

    // Every tool call Claude Code makes (shadow_* or otherwise) is already
    // fully resolved through shadow-code-tools MCP by the time it appears in
    // this stream - Continue's real execution + approval path already ran.
    // Pairing the assistant tool_use message with its tool_result
    // immediately after (mirroring tokenOptimizedStreamChat's own pattern
    // for shadow tool calls) is what tells Continue's UI/state machine this
    // is already-resolved history rather than pending work to execute -
    // critical for parity with the normal API-key path and to avoid
    // double-execution (see the "claudecode" bypass in tokenOptimizedChat.ts
    // and the forced-ultra-mode routing in streamChat.ts).
    try {
      for await (const chunk of child.stdout) {
        buffer += chunk.toString();
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          let event: StreamJsonEvent;
          try {
            event = JSON.parse(line);
          } catch {
            continue; // Not every line is guaranteed to be JSON we care about
          }

          if (event.type === "assistant" && event.message?.content) {
            let text = "";
            const toolCalls: ToolCallDelta[] = [];
            for (const block of event.message.content) {
              if (block.type === "text") {
                text += block.text;
              } else if (block.type === "tool_use") {
                toolCalls.push({
                  id: block.id,
                  type: "function",
                  function: {
                    name: block.name.startsWith(MCP_TOOL_PREFIX)
                      ? block.name.slice(MCP_TOOL_PREFIX.length)
                      : block.name,
                    arguments: JSON.stringify(block.input ?? {}),
                  },
                });
              }
            }
            if (text || toolCalls.length > 0) {
              yield {
                role: "assistant",
                content: text,
                ...(toolCalls.length > 0 ? { toolCalls } : {}),
              };
            }
            continue;
          }

          if (event.type === "user" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "tool_result") {
                yield {
                  role: "tool",
                  toolCallId: block.tool_use_id,
                  content: toolResultText(block.content),
                };
              }
            }
            continue;
          }

          if (event.type === "result" && event.usage) {
            usage = {
              promptTokens: event.usage.input_tokens ?? 0,
              completionTokens: event.usage.output_tokens ?? 0,
              promptTokensDetails: {
                cachedTokens: event.usage.cache_read_input_tokens,
                cacheWriteTokens: event.usage.cache_creation_input_tokens,
              },
            };
          }
        }
      }
    } finally {
      signal.removeEventListener("abort", onAbort);
      mcpServer.unregisterSession(sessionId);
      await fs.unlink(mcpConfigPath).catch(() => {});
    }

    const exitCode: number = await new Promise((resolve) =>
      child.once("close", resolve),
    );
    if (exitCode !== 0 && !signal.aborted) {
      throw new Error(
        `claude CLI exited with code ${exitCode}${stderr ? `: ${stderr}` : ""}`,
      );
    }

    if (usage) {
      yield { role: "assistant", content: "", usage };
    }
  }
}

export default ClaudeCodeCli;
