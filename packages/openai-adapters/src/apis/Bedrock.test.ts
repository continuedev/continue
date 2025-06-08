import { jest } from "@jest/globals";
import { BedrockApi } from "./Bedrock.js";

// Mock the AnthropicBedrock SDK
jest.mock("@anthropic-ai/bedrock-sdk", () => ({
  AnthropicBedrock: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

test("BedrockApi should initialize with default region", () => {
  const api = new BedrockApi({
    provider: "bedrock",
    env: {},
  });

  expect(api).toBeInstanceOf(BedrockApi);
});

test("BedrockApi should initialize with custom region", () => {
  const api = new BedrockApi({
    provider: "bedrock",
    env: {
      region: "us-west-2",
      profile: "custom-profile",
    },
  });

  expect(api).toBeInstanceOf(BedrockApi);
});

test("chatCompletionStream should be a function", () => {
  const api = new BedrockApi({
    provider: "bedrock",
    env: {},
  });

  expect(typeof api.chatCompletionStream).toBe("function");
});

test("list should return available models", async () => {
  const api = new BedrockApi({
    provider: "bedrock",
    env: {},
  });

  const models = await api.list();

  expect(Array.isArray(models)).toBe(true);
  expect(models.length).toBeGreaterThan(0);
  expect(models[0]).toHaveProperty("id");
  expect(models[0]).toHaveProperty("object", "model");
  expect(models[0]).toHaveProperty("owned_by", "amazon-bedrock");
});

test("unsupported methods should throw errors", async () => {
  const api = new BedrockApi({
    provider: "bedrock",
    env: {},
  });

  const signal = new AbortController().signal;

  await expect(api.completionNonStream({} as any, signal)).rejects.toThrow();
  await expect(api.embed({})).rejects.toThrow();
  await expect(api.rerank({} as any)).rejects.toThrow();
});
