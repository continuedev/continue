import { ChatDescriber } from "./chatDescriber";
import { testLLM } from "../test/fixtures";
import { LLMFullCompletionOptions } from "..";

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

    it("should set completionOptions.maxTokens to 6", async () => {
      const message = "Test message";
      const completionOptions: LLMFullCompletionOptions = { temperature: 0.7 };

      testLLM.chat = jest.fn().mockResolvedValue({ content: "Test response" });

      await ChatDescriber.describe(testLLM, completionOptions, message);

      expect(completionOptions.maxTokens).toBe(6);
    });

    it("should call model.chat with correct parameters", async () => {
      const message = "Test message";
      const cleanedMessage = "Test message";
      const expectedPrompt = ChatDescriber.prompt + cleanedMessage;
      const completionOptions: LLMFullCompletionOptions = {};

      testLLM.chat = jest.fn().mockResolvedValue({ content: "Test response" });

      await ChatDescriber.describe(testLLM, completionOptions, message);

      expect(testLLM.chat).toHaveBeenCalledWith(
        [
          {
            role: "user",
            content: expectedPrompt,
          },
        ],
        expect.any(AbortSignal),
        completionOptions,
      );
    });

    it("should return processed content from the model response", async () => {
      const message = "Test message";
      const modelResponseContent = "Model response content";
      const expectedResult = "Model response content";

      testLLM.chat = jest
        .fn()
        .mockResolvedValue({ content: modelResponseContent });

      const result = await ChatDescriber.describe(testLLM, {}, message);

      expect(result).toBe(expectedResult);
    });

    it("should propagate error if model.chat throws an error", async () => {
      const message = "Test message";
      const completionOptions: LLMFullCompletionOptions = {};

      testLLM.chat = jest.fn().mockRejectedValue(new Error("Chat error"));

      await expect(
        ChatDescriber.describe(testLLM, completionOptions, message),
      ).rejects.toThrow("Chat error");
    });
  });
});
