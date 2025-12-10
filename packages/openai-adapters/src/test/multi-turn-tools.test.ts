import * as dotenv from "dotenv";
import { getLlmApi } from "./util.js";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";

dotenv.config();

/**
 * Test multi-turn conversation with tool calls to reproduce the zod error
 */

if (process.env.ANTHROPIC_API_KEY) {
  describe("Multi-turn Tool Call Test (Anthropic)", () => {
    // Set feature flag at describe-time (before test collection)
    process.env.USE_VERCEL_AI_SDK_ANTHROPIC = "true";

    afterAll(() => {
      delete process.env.USE_VERCEL_AI_SDK_ANTHROPIC;
    });

    test("should handle multi-turn conversation with tool calls and tool results", async () => {
      // Create fresh API instance with flag already set
      const api = getLlmApi({
        provider: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY!,
      });

      const tools = [
        {
          type: "function" as const,
          function: {
            name: "List",
            description: "List files in a directory",
            parameters: {
              type: "object",
              required: ["dirpath"],
              properties: {
                dirpath: {
                  type: "string",
                  description: "The directory path to list",
                },
              },
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "Read",
            description: "Read a file",
            parameters: {
              type: "object",
              required: ["filepath"],
              properties: {
                filepath: {
                  type: "string",
                  description: "The path of the file to read",
                },
              },
            },
          },
        },
      ];

      // Turn 1: User asks to investigate codebase
      const messages1: ChatCompletionMessageParam[] = [
        {
          role: "user",
          content: "please investigate this codebase a bit",
        },
      ];

      console.log("\n=== Turn 1: Initial request ===");
      let assistantResponse = "";
      const toolCalls: any[] = [];

      for await (const chunk of api.chatCompletionStream(
        {
          model: "claude-haiku-4-5",
          messages: messages1,
          tools,
          stream: true,
        },
        new AbortController().signal,
      )) {
        if (chunk.choices.length > 0) {
          const delta = chunk.choices[0].delta;
          if (delta.content) {
            assistantResponse += delta.content;
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                // New tool call
                toolCalls.push({
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.function?.name || "",
                    arguments: tc.function?.arguments || "",
                  },
                });
              } else if (tc.index !== undefined && toolCalls[tc.index]) {
                // Delta for existing tool call
                if (tc.function?.arguments) {
                  toolCalls[tc.index].function.arguments +=
                    tc.function.arguments;
                }
              }
            }
          }
        }
      }

      console.log("Assistant response:", assistantResponse);
      console.log("Tool calls:", JSON.stringify(toolCalls, null, 2));

      expect(toolCalls.length).toBeGreaterThan(0);

      // Turn 2: Send tool results back
      const messages2: ChatCompletionMessageParam[] = [
        ...messages1,
        {
          role: "assistant",
          content: assistantResponse || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        {
          role: "tool",
          tool_call_id: toolCalls[0].id,
          content: "Files in /test:\npackage.json (file)\nREADME.md (file)",
        },
      ];

      // Add more tool results if there were multiple tool calls
      for (let i = 1; i < toolCalls.length; i++) {
        messages2.push({
          role: "tool",
          tool_call_id: toolCalls[i].id,
          content: `Result for ${toolCalls[i].function.name}`,
        });
      }

      console.log("\n=== Turn 2: Sending tool results ===");
      console.log("Messages:", JSON.stringify(messages2, null, 2));

      // This should trigger the zod error if the bug exists
      let response2 = "";
      for await (const chunk of api.chatCompletionStream(
        {
          model: "claude-haiku-4-5",
          messages: messages2,
          tools,
          stream: true,
        },
        new AbortController().signal,
      )) {
        if (chunk.choices.length > 0) {
          response2 += chunk.choices[0].delta.content ?? "";
        }
      }

      console.log("Second response:", response2);
      expect(response2.length).toBeGreaterThan(0);
    }, 60000);
  });
} else {
  test.skip("Multi-turn tool call test skipped - no Anthropic API key", () => {});
}
