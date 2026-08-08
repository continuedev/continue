/**
 * Converts OpenAI ChatCompletionMessageParam format to Vercel AI SDK CoreMessage format
 */

import type { ChatCompletionMessageParam } from "openai/resources/index.js";

export interface VercelCoreMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<any>;
}

/**
 * Converts OpenAI messages to Vercel AI SDK CoreMessage format.
 *
 * Key differences:
 * - OpenAI tool calls: { role: "assistant", tool_calls: [{ id, function: { name, arguments } }] }
 * - Vercel tool calls: { role: "assistant", content: [{ type: "tool-call", toolCallId, toolName, input }] }
 * - OpenAI tool results: { role: "tool", tool_call_id: "...", content: "string" }
 * - Vercel tool results: { role: "tool", content: [{ type: "tool-result", toolCallId: "...", toolName: "...", result: any }] }
 *
 * IMPORTANT: For multi-turn conversations with tools:
 * - We include assistant messages with tool_calls converted to Vercel format
 */
export function convertOpenAIMessagesToVercel(
  messages: ChatCompletionMessageParam[],
): VercelCoreMessage[] {
  const vercelMessages: VercelCoreMessage[] = [];

  // Build a map of tool_call_id => toolName from assistant messages
  const toolCallMap = new Map<string, string>();

  // First pass: collect tool call names
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (tc.type === "function") {
          toolCallMap.set(tc.id, tc.function.name);
        }
      }
    }
  }

  // Second pass: convert messages
  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        vercelMessages.push({
          role: "system",
          content:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content),
        });
        break;

      case "user":
        vercelMessages.push({
          role: "user",
          content: msg.content,
        });
        break;

      case "assistant":
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const contentParts: any[] = [];

          if (msg.content) {
            contentParts.push({
              type: "text",
              text: msg.content,
            });
          }

          for (const tc of msg.tool_calls) {
            if (tc.type === "function") {
              let input: unknown;
              try {
                input = JSON.parse(tc.function.arguments);
              } catch {
                input = tc.function.arguments;
              }

              const thoughtSignature = (tc as any)?.extra_content?.google
                ?.thought_signature as string | undefined;

              contentParts.push({
                type: "tool-call",
                toolCallId: tc.id,
                toolName: tc.function.name,
                input,
                ...(thoughtSignature && {
                  providerOptions: {
                    google: {
                      thoughtSignature,
                    },
                  },
                }),
              });
            }
          }

          vercelMessages.push({
            role: "assistant",
            content: contentParts,
          });
        } else {
          vercelMessages.push({
            role: "assistant",
            content: msg.content || "",
          });
        }
        break;

      case "tool":
        // Convert OpenAI tool result to Vercel format
        const toolName = toolCallMap.get(msg.tool_call_id) || "unknown_tool";
        vercelMessages.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: msg.tool_call_id,
              toolName,
              output: {
                type: "text",
                value:
                  typeof msg.content === "string"
                    ? msg.content
                    : JSON.stringify(msg.content),
              },
            },
          ],
        });
        break;
    }
  }

  return vercelMessages;
}
