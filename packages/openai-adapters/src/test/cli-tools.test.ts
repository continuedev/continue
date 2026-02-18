import * as dotenv from "dotenv";
import { getLlmApi } from "./util.js";

dotenv.config();

/**
 * Test with actual CLI tool format to reproduce zod error
 */

if (process.env.OPENAI_API_KEY) {
  describe("CLI Tool Format Test", () => {
    // Set feature flag
    beforeAll(() => {
      process.env.USE_VERCEL_AI_SDK_OPENAI = "true";
    });

    afterAll(() => {
      delete process.env.USE_VERCEL_AI_SDK_OPENAI;
    });

    test("should work with actual CLI tool format (after toChatBody conversion)", async () => {
      const api = getLlmApi({
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY!,
      });

      // This is the format AFTER toChatBody conversion (what openai-adapters receives)
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "readFile",
            description:
              "Use this tool if you need to view the contents of an existing file.",
            parameters: {
              type: "object",
              required: ["filepath"],
              properties: {
                filepath: {
                  type: "string",
                  description:
                    "The path of the file to read. Can be a relative path (from workspace root), absolute path, tilde path (~/...), or file:// URI",
                },
              },
            },
          },
        },
      ];

      console.log("Testing with tools:", JSON.stringify(tools, null, 2));

      let response = "";
      for await (const chunk of api.chatCompletionStream(
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: "List the available tools you have access to.",
            },
          ],
          tools,
          stream: true,
        },
        new AbortController().signal,
      )) {
        if (chunk.choices.length > 0) {
          response += chunk.choices[0].delta.content ?? "";
        }
      }

      expect(response.length).toBeGreaterThan(0);
      console.log("Response:", response);
    });

    test("should work with empty tools array", async () => {
      const api = getLlmApi({
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY!,
      });

      // Test with empty array (common case)
      const tools: any[] = [];

      let response = "";
      for await (const chunk of api.chatCompletionStream(
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: "Hello!",
            },
          ],
          tools,
          stream: true,
        },
        new AbortController().signal,
      )) {
        if (chunk.choices.length > 0) {
          response += chunk.choices[0].delta.content ?? "";
        }
      }

      expect(response.length).toBeGreaterThan(0);
    });

    test("should work with undefined tools", async () => {
      const api = getLlmApi({
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY!,
      });

      let response = "";
      for await (const chunk of api.chatCompletionStream(
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: "Hello!",
            },
          ],
          tools: undefined,
          stream: true,
        },
        new AbortController().signal,
      )) {
        if (chunk.choices.length > 0) {
          response += chunk.choices[0].delta.content ?? "";
        }
      }

      expect(response.length).toBeGreaterThan(0);
    });
  });
} else {
  test.skip("CLI tool format tests skipped - no OpenAI API key", () => {});
}
