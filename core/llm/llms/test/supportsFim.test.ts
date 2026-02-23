import { jest } from "@jest/globals";
import Anthropic from "../Anthropic.js";
import Deepseek from "../Deepseek.js";
import FunctionNetwork from "../FunctionNetwork.js";
import Mistral from "../Mistral.js";
import OpenAI from "../OpenAI.js";
import ContinueProxy from "../stubs/ContinueProxy.js";
import Vllm from "../Vllm.js";

// Mock the parseProxyModelName function
const mockParseProxyModelName = jest.fn();
jest.mock("@continuedev/config-yaml", () => ({
  parseProxyModelName: mockParseProxyModelName,
  decodeSecretLocation: jest.fn(),
  SecretType: { NotFound: "not-found" },
}));

// Test cases: [LLM class, model, expected supportsFim result, description]
const testCases: [any, string, boolean, string][] = [
  [ContinueProxy, "owner/package/vllm/some-model", false, "vllm provider"],
  [ContinueProxy, "owner/package/openai/gpt-4", true, "openai provider"],
  [
    ContinueProxy,
    "owner/package/anthropic/claude-3",
    true,
    "anthropic provider",
  ],
  [ContinueProxy, "owner/package/cohere/command-r", true, "cohere provider"],
  [
    ContinueProxy,
    "owner/package/unknown-provider/some-model",
    true,
    "unknown provider",
  ],
  [ContinueProxy, "owner/package/groq/llama-model", true, "groq provider"],
  [Vllm, "any-model", false, "Vllm"],
  [Anthropic, "claude-3-5-sonnet-latest", false, "Anthropic"],
  [FunctionNetwork, "any-model", false, "FunctionNetwork"],
  [OpenAI, "codestral", false, "OpenAI"],
  [Mistral, "codestral", true, "Mistral"],
  [Deepseek, "deepseek-chat", true, "Deepseek"],
];

testCases.forEach(([LLMClass, model, expectedResult, description]) => {
  test(`supportsFim returns ${expectedResult} for ${description}`, () => {
    const llm = new LLMClass({
      model,
      apiKey: "test-key",
    });

    const result = llm.supportsFim();

    expect(result).toBe(expectedResult);
  });
});
