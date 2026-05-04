import { describe, expect, it } from "vitest";

import { AzureApi } from "./Azure.js";

describe("AzureApi", () => {
  describe("constructor and URL configuration", () => {
    it("should create instance with azure-openai type and required env properties", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://myresource.openai.azure.com/",
        apiKey: "test-key",
        env: {
          apiType: "azure-openai",
          deployment: "my-deployment",
          apiVersion: "2024-02-01",
        },
      });

      expect(api).toBeInstanceOf(AzureApi);
    });

    it("should throw error when deployment is missing for azure-openai type", () => {
      expect(() => {
        new AzureApi({
          provider: "azure",
          apiBase: "https://myresource.openai.azure.com/",
          apiKey: "test-key",
          env: {
            apiType: "azure-openai",
            apiVersion: "2024-02-01",
          },
        });
      }).toThrow(
        "`env.deployment` is a required configuration property for Azure OpenAI",
      );
    });

    it("should throw error when apiVersion is missing for azure-openai type", () => {
      expect(() => {
        new AzureApi({
          provider: "azure",
          apiBase: "https://myresource.openai.azure.com/",
          apiKey: "test-key",
          env: {
            apiType: "azure-openai",
            deployment: "my-deployment",
          },
        });
      }).toThrow(
        "`env.apiVersion` is a required configuration property for Azure OpenAI",
      );
    });

    it("should support legacy 'azure' apiType", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://myresource.openai.azure.com/",
        apiKey: "test-key",
        env: {
          apiType: "azure",
          deployment: "my-deployment",
          apiVersion: "2024-02-01",
        },
      });

      expect(api).toBeInstanceOf(AzureApi);
    });

    it("should create instance without azure-openai specific env when apiType is different", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://api.example.com/",
        apiKey: "test-key",
        env: {
          apiType: "azure-foundry",
        },
      });

      expect(api).toBeInstanceOf(AzureApi);
    });

    it("should create instance when env is undefined", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://api.example.com/",
        apiKey: "test-key",
      });

      expect(api).toBeInstanceOf(AzureApi);
    });
  });

  describe("_filterEmptyContentParts", () => {
    it("should filter out empty text content parts from array content", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://api.example.com/",
        apiKey: "test-key",
      });

      const body = {
        model: "gpt-4",
        messages: [
          {
            role: "user" as const,
            content: [
              { type: "text", text: "Hello" },
              { type: "text", text: "" },
              { type: "text", text: "World" },
            ],
          },
        ],
      };

      const result = api.modifyChatBody(body);

      expect(result.messages[0].content).toHaveLength(2);
      expect(result.messages[0].content).toEqual([
        { type: "text", text: "Hello" },
        { type: "text", text: "World" },
      ]);
    });

    it("should filter out whitespace-only text content parts", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://api.example.com/",
        apiKey: "test-key",
      });

      const body = {
        model: "gpt-4",
        messages: [
          {
            role: "user" as const,
            content: [
              { type: "text", text: "Hello" },
              { type: "text", text: "   " },
              { type: "text", text: "\n\t" },
            ],
          },
        ],
      };

      const result = api.modifyChatBody(body);

      expect(result.messages[0].content).toHaveLength(1);
      expect(result.messages[0].content).toEqual([
        { type: "text", text: "Hello" },
      ]);
    });

    it("should keep non-text content parts", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://api.example.com/",
        apiKey: "test-key",
      });

      const body = {
        model: "gpt-4",
        messages: [
          {
            role: "user" as const,
            content: [
              { type: "text", text: "" },
              {
                type: "image_url",
                image_url: { url: "http://example.com/img.png" },
              },
            ],
          },
        ],
      };

      const result = api.modifyChatBody(body);

      expect(result.messages[0].content).toHaveLength(1);
      expect(result.messages[0].content[0]).toEqual({
        type: "image_url",
        image_url: { url: "http://example.com/img.png" },
      });
    });

    it("should preserve original content if all parts would be filtered", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://api.example.com/",
        apiKey: "test-key",
      });

      const body = {
        model: "gpt-4",
        messages: [
          {
            role: "user" as const,
            content: [
              { type: "text", text: "" },
              { type: "text", text: "   " },
            ],
          },
        ],
      };

      const result = api.modifyChatBody(body);

      // Should preserve original content when all would be filtered
      expect(result.messages[0].content).toHaveLength(2);
    });

    it("should not modify string content", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://api.example.com/",
        apiKey: "test-key",
      });

      const body = {
        model: "gpt-4",
        messages: [
          {
            role: "user" as const,
            content: "Hello World",
          },
        ],
      };

      const result = api.modifyChatBody(body);

      expect(result.messages[0].content).toBe("Hello World");
    });

    it("should handle multiple messages", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://api.example.com/",
        apiKey: "test-key",
      });

      const body = {
        model: "gpt-4",
        messages: [
          {
            role: "system" as const,
            content: "You are a helpful assistant",
          },
          {
            role: "user" as const,
            content: [
              { type: "text", text: "" },
              { type: "text", text: "Question" },
            ],
          },
          {
            role: "assistant" as const,
            content: "Answer",
          },
        ],
      };

      const result = api.modifyChatBody(body);

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].content).toBe("You are a helpful assistant");
      expect(result.messages[1].content).toHaveLength(1);
      expect(result.messages[1].content[0]).toEqual({
        type: "text",
        text: "Question",
      });
      expect(result.messages[2].content).toBe("Answer");
    });

    it("should handle messages with null or undefined text", () => {
      const api = new AzureApi({
        provider: "azure",
        apiBase: "https://api.example.com/",
        apiKey: "test-key",
      });

      const body = {
        model: "gpt-4",
        messages: [
          {
            role: "user" as const,
            content: [
              { type: "text", text: null },
              { type: "text", text: "Valid" },
              { type: "text", text: undefined },
            ],
          },
        ],
      };

      const result = api.modifyChatBody(body as any);

      expect(result.messages[0].content).toHaveLength(1);
      expect(result.messages[0].content[0]).toEqual({
        type: "text",
        text: "Valid",
      });
    });
  });
});
