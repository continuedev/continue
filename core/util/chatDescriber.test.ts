import { LLMFullCompletionOptions } from "..";
import { testLLM } from "../test/fixtures";
import { ChatDescriber } from "./chatDescriber";

describe("ChatDescriber", () => {
  beforeEach(() => {
    // Reset the prompt to the initial value before each test
    ChatDescriber.prompt =
      "Given the following... please reply with a short summary that is 4-12 words in length, you should summarize what the user is asking for OR what the user is trying to accomplish. You should only respond with the summary, no additional text or explanation, you don't need ending punctuation.\n\n";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("describe method", () => {
    it("should return undefined if ChatDescriber.prompt is undefined", async () => {
      ChatDescriber.prompt = undefined;

      const result = await ChatDescriber.describe(testLLM, {}, "Test message");

      expect(result).toBeUndefined();
    });

    it("should return undefined if message is empty after cleaning", async () => {
      const message = "   ";

      const result = await ChatDescriber.describe(testLLM, {}, message);

      expect(result).toBeUndefined();
    });

    it("should set completionOptions.maxTokens to 16", async () => {
      const message = "Test message";
      const completionOptions: LLMFullCompletionOptions = { temperature: 0.7 };

      testLLM.chatStreams = [[{ role: "assistant", content: "Test response" }]];

      await ChatDescriber.describe(testLLM, completionOptions, message);

      expect(completionOptions.maxTokens).toBe(ChatDescriber.maxTokens);
    });

    it("should return processed content from the model response", async () => {
      const message = "Test message";
      const modelResponseContent = "Model response content";
      const expectedResult = "Model response content";

      testLLM.chatStreams = [
        [{ role: "assistant", content: modelResponseContent }],
      ];

      const result = await ChatDescriber.describe(testLLM, {}, message);

      expect(result).toBe(expectedResult);
    });

    it("should propagate error if model.chat throws an error", async () => {
      const message = "Test message";
      const completionOptions: LLMFullCompletionOptions = {};

      testLLM.chatStreams = [["ERROR"]];

      await expect(
        ChatDescriber.describe(testLLM, completionOptions, message),
      ).rejects.toThrow();
    });

    it("should exclude thinking/reasoning content from the generated title", async () => {
      const message = "Help me write a sorting algorithm";

      // Simulate a model that emits a thinking chunk followed by an assistant chunk
      testLLM.chatStreams = [
        [
          { role: "thinking", content: "Here is my thinking process, I need to consider various sorting algorithms..." },
          { role: "assistant", content: "Sorting Algorithm Help" },
        ],
      ];

      const result = await ChatDescriber.describe(testLLM, {}, message);

      // The title should come from the assistant chunk, not the thinking chunk
      expect(result).toBe("Sorting Algorithm Help");
      expect(result).not.toContain("thinking process");
    });
  });
});
