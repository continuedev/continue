import { describe, expect, it } from "vitest";

import {
  APPLY_UNIQUE_TOKEN,
  INCEPTION_API_BASE,
  InceptionApi,
  UNIQUE_TOKEN,
} from "./Inception.js";

describe("InceptionApi", () => {
  const baseConfig = {
    provider: "inception" as const,
    apiKey: "test-key",
  };

  describe("constructor", () => {
    it("uses default Inception API base when not specified", () => {
      const api = new InceptionApi(baseConfig);
      expect(api.apiBase).toBe(INCEPTION_API_BASE);
    });

    it("uses custom API base when specified", () => {
      const customBase = "https://custom.api.base/v1/";
      const api = new InceptionApi({
        ...baseConfig,
        apiBase: customBase,
      });
      expect(api.apiBase).toBe(customBase);
    });
  });

  describe("isNextEdit (via chatCompletionStream routing)", () => {
    it("detects next edit token in last message", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        { role: "user" as const, content: "First message" },
        { role: "assistant" as const, content: "Response" },
        { role: "user" as const, content: `Edit this code${UNIQUE_TOKEN}` },
      ];

      // Access private method via bracket notation
      expect(api["isNextEdit"](messages)).toBe(true);
    });

    it("detects next edit token in any message", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        { role: "user" as const, content: `First${UNIQUE_TOKEN}` },
        { role: "assistant" as const, content: "Response" },
        { role: "user" as const, content: "Second message" },
      ];

      expect(api["isNextEdit"](messages)).toBe(true);
    });

    it("returns false when no next edit token present", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi" },
      ];

      expect(api["isNextEdit"](messages)).toBe(false);
    });

    it("returns false when content is not a string", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: `Hello${UNIQUE_TOKEN}` }],
        },
      ];

      expect(api["isNextEdit"](messages)).toBe(false);
    });

    it("returns false for partial token match", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        { role: "user" as const, content: "Hello <|!@#IS_NEXT" },
      ];

      expect(api["isNextEdit"](messages)).toBe(false);
    });
  });

  describe("isApply (via private method)", () => {
    it("detects apply token in last message", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        { role: "user" as const, content: "First message" },
        {
          role: "assistant" as const,
          content: "Response",
        },
        {
          role: "user" as const,
          content: `Apply changes${APPLY_UNIQUE_TOKEN}`,
        },
      ];

      expect(api["isApply"](messages)).toBe(true);
    });

    it("detects apply token in any message", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        { role: "user" as const, content: `First${APPLY_UNIQUE_TOKEN}` },
        { role: "assistant" as const, content: "Response" },
        { role: "user" as const, content: "Second message" },
      ];

      expect(api["isApply"](messages)).toBe(true);
    });

    it("returns false when no apply token present", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi" },
      ];

      expect(api["isApply"](messages)).toBe(false);
    });

    it("returns false when content is not a string", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: `Hello${APPLY_UNIQUE_TOKEN}` },
          ],
        },
      ];

      expect(api["isApply"](messages)).toBe(false);
    });
  });

  describe("removeToken", () => {
    it("removes token from last message content", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        { role: "user" as const, content: "First" },
        {
          role: "user" as const,
          content: `Edit code${UNIQUE_TOKEN}`,
        },
      ];

      const result = api["removeToken"](messages, UNIQUE_TOKEN);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe("First");
      expect(result[1].content).toBe("Edit code");
    });

    it("returns original messages when last message does not end with token", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        { role: "user" as const, content: "First" },
        { role: "user" as const, content: "Second" },
      ];

      const result = api["removeToken"](messages, UNIQUE_TOKEN);

      expect(result).toEqual(messages);
    });

    it("returns original messages when last message content is not a string", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        { role: "user" as const, content: "First" },
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: `Content${UNIQUE_TOKEN}` }],
        },
      ];

      const result = api["removeToken"](messages, UNIQUE_TOKEN);

      expect(result).toEqual(messages);
    });

    it("does not modify original messages array", () => {
      const api = new InceptionApi(baseConfig);
      const originalContent = `Edit${UNIQUE_TOKEN}`;
      const messages = [{ role: "user" as const, content: originalContent }];

      api["removeToken"](messages, UNIQUE_TOKEN);

      expect(messages[0].content).toBe(originalContent);
    });

    it("handles empty messages array", () => {
      const api = new InceptionApi(baseConfig);
      const messages: { role: "user"; content: string }[] = [];

      const result = api["removeToken"](messages, UNIQUE_TOKEN);

      expect(result).toEqual([]);
    });

    it("removes apply token correctly", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        {
          role: "user" as const,
          content: `Apply this${APPLY_UNIQUE_TOKEN}`,
        },
      ];

      const result = api["removeToken"](messages, APPLY_UNIQUE_TOKEN);

      expect(result[0].content).toBe("Apply this");
    });

    it("preserves other message properties when removing token", () => {
      const api = new InceptionApi(baseConfig);
      const messages = [
        {
          role: "user" as const,
          content: `Hello${UNIQUE_TOKEN}`,
          name: "test-user",
        },
      ];

      const result = api["removeToken"](messages, UNIQUE_TOKEN);

      expect(result[0]).toEqual({
        role: "user",
        content: "Hello",
        name: "test-user",
      });
    });
  });

  describe("list", () => {
    it("throws not implemented error", () => {
      const api = new InceptionApi(baseConfig);

      expect(() => api.list()).toThrow("Method not implemented.");
    });
  });

  describe("token constants", () => {
    it("exports correct UNIQUE_TOKEN value", () => {
      expect(UNIQUE_TOKEN).toBe("<|!@#IS_NEXT_EDIT!@#|>");
    });

    it("exports correct APPLY_UNIQUE_TOKEN value", () => {
      expect(APPLY_UNIQUE_TOKEN).toBe("<|!@#IS_APPLY!@#|>");
    });

    it("exports correct INCEPTION_API_BASE value", () => {
      expect(INCEPTION_API_BASE).toBe("https://api.inceptionlabs.ai/v1/");
    });
  });
});
