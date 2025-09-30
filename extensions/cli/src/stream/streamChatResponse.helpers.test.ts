import { describe, expect, it, vi } from "vitest";

import type { PreprocessedToolCall } from "../tools/types.js";

import { handleHeadlessPermission } from "./streamChatResponse.helpers.js";

describe("streamChatResponse.helpers", () => {
  describe("handleHeadlessPermission", () => {
    it("should display error message and exit when tool requires permission in headless mode", async () => {
      // Mock the tool call
      const toolCall: PreprocessedToolCall = {
        id: "call_123",
        name: "Write",
        arguments: { filepath: "test.txt", content: "hello" },
        argumentsStr: '{"filepath":"test.txt","content":"hello"}',
        startNotified: false,
        tool: {
          name: "Write",
          displayName: "Write",

          description: "Write to a file",
          parameters: {
            type: "object",
            properties: {},
          },
          run: vi.fn(),
          isBuiltIn: true,
        },
      };

      // Mock safeStderr to capture output
      const stderrOutputs: string[] = [];
      vi.doMock("../init.js", () => ({
        safeStderr: (message: string) => {
          stderrOutputs.push(message);
        },
      }));

      // Mock gracefulExit to prevent actual process exit
      let exitCode: number | undefined;
      vi.doMock("../util/exit.js", () => ({
        gracefulExit: async (code: number) => {
          exitCode = code;
        },
      }));

      // Call the function (it should exit gracefully)
      try {
        await handleHeadlessPermission(toolCall);
      } catch (error) {
        // Expected to throw after exit
      }

      // Verify error message was displayed
      const fullOutput = stderrOutputs.join("");
      expect(fullOutput).toContain("requires permission");
      expect(fullOutput).toContain("headless mode");
      expect(fullOutput).toContain("--auto");
      expect(fullOutput).toContain("--allow");
      expect(fullOutput).toContain("--exclude");
      expect(fullOutput).toContain("Write");

      // Verify it tried to exit with code 1
      expect(exitCode).toBe(1);
    });
  });
});
