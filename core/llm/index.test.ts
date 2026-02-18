import { ChatMessage, LLMOptions } from "..";

import { allModelProviders } from "@continuedev/llm-info";
import { LlmInfo } from "@continuedev/llm-info/dist/types";
import { BaseLLM } from ".";
import { DEFAULT_CONTEXT_LENGTH } from "./constants";
import { LLMClasses } from "./llms";
import { LLMLogger } from "./logger";

class DummyLLM extends BaseLLM {
  static providerName = "openai";
  static defaultOptions: Partial<LLMOptions> = {
    model: "dummy-model",
    contextLength: 200_000,
    completionOptions: {
      model: "some-model",
      maxTokens: 4096,
    },
    apiBase: "https://api.test-api-dummy.com/v1/",
  };
}
describe("BaseLLM", () => {
  let baseLLM: BaseLLM;

  beforeEach(() => {
    const options: LLMOptions = {
      model: "dummy-model",
    };
    // Instantiate a DummyLLM instance
    baseLLM = new DummyLLM(options);
  });

  describe("BaseLLM constructor", () => {
    it("should correctly initialize with given options", () => {
      const templatMessagesFunction = (messages: ChatMessage[]) => {
        return messages[0]?.content.toString() ?? "";
      };
      const llmLogger = new LLMLogger();
      const options: LLMOptions = {
        model: "gpt-3.5-turbo",
        uniqueId: "testId",
        contextLength: 1024,
        completionOptions: {
          model: "some-model",
          maxTokens: 150,
        },
        requestOptions: {},
        promptTemplates: {},
        templateMessages: templatMessagesFunction,
        logger: llmLogger,
        llmRequestHook: () => {},
        apiKey: "testApiKey",
        aiGatewaySlug: "testSlug",
        apiBase: "https://api.example.com",
        accountId: "testAccountId",
        deployment: "davinci",
        apiVersion: "v1",
        apiType: "public",
        region: "us",
        projectId: "testProjectId",
      };

      const instance = new DummyLLM(options);

      expect(instance.title).toBeDefined();
      expect(instance.uniqueId).toBe("testId");
      expect(instance.model).toBe("gpt-3.5-turbo");
      expect(instance.contextLength).toBe(1024);
      expect(instance.completionOptions.maxTokens).toBe(150);
      expect(instance.requestOptions).toEqual({});
      expect(instance.promptTemplates).toEqual({});
      expect(instance.templateMessages).toEqual(templatMessagesFunction);
      expect(instance.logger).toBe(llmLogger);
      expect(instance.apiKey).toBe("testApiKey");
      expect(instance.aiGatewaySlug).toBe("testSlug");
      expect(instance.apiBase).toBe("https://api.example.com/");
      expect(instance.accountId).toBe("testAccountId");
      expect(instance.deployment).toBe("davinci");
      expect(instance.apiVersion).toBe("v1");
      expect(instance.apiType).toBe("public");
      expect(instance.region).toBe("us");
      expect(instance.projectId).toBe("testProjectId");
    });
  });

  test("model should return correct provider model", () => {
    expect(baseLLM.model).toBe("dummy-model");
  });

  test("supportsFim should always return false", () => {
    expect(baseLLM.supportsFim()).toBe(false);
  });

  describe("supportsImages", () => {
    test("should return true when modelSupportsImages returns true", () => {
      baseLLM.model = "gpt-4-vision";
      expect(baseLLM.supportsImages()).toBe(true);

      baseLLM.model = "fancy-vision-model";
      expect(baseLLM.supportsImages()).toBe(true);

      baseLLM.model = "gemma3:4b";
      expect(baseLLM.supportsImages()).toBe(true);

      baseLLM.model = "google/gemma-3-270m";
      expect(baseLLM.supportsImages()).toBe(true);

      baseLLM.model = "foo/paligemma-custom-100";
      expect(baseLLM.supportsImages()).toBe(true);

      baseLLM.model = "foo/medgemma_4b_it_16Q";
      expect(baseLLM.supportsImages()).toBe(true);

      baseLLM.model = "qwen2.5vl";
      expect(baseLLM.supportsImages()).toBe(true);
    });

    test("should return false when modelSupportsImages returns false", () => {
      expect(baseLLM.supportsImages()).toBe(false);

      baseLLM.model = "gemma3n";
      expect(baseLLM.supportsImages()).toBe(false);
    });
  });

  describe("supportsCompletions", () => {
    test("should return correctly under specific conditions", () => {
      // Mocking properties and scenarios to match the conditions in supportsCompletions
      baseLLM.apiBase = "api.groq.com";
      expect(baseLLM.supportsCompletions()).toBe(false);

      baseLLM.apiBase = "integrate.api.nvidia.com";
      expect(baseLLM.supportsCompletions()).toBe(false);

      baseLLM.apiBase = "api.mistral.ai";
      expect(baseLLM.supportsCompletions()).toBe(false);

      baseLLM.apiBase = ":1337";
      expect(baseLLM.supportsCompletions()).toBe(false);

      baseLLM.apiBase = "something:3000";
      expect(baseLLM.supportsCompletions()).toBe(true);
    });
  });
  describe("supportsPrefill", () => {
    test("should return correctly under specific conditions", () => {
      expect(baseLLM.supportsPrefill()).toBe(false);

      class PrefillLLM extends BaseLLM {
        static providerName = "ollama";
      }
      const prefillLLM = new PrefillLLM({ model: "some-model" });
      expect(prefillLLM.supportsPrefill()).toBe(true);
    });
  });
  describe("fetch", () => {
    // TODO: Implement tests for fetch method
  });
  describe("*_streamFim", () => {
    // TODO: Implement tests for *_streamFim method
  });
  describe("complete", () => {
    // TODO: Implement tests for complete method
  });
  describe("*streamChat", () => {
    // TODO: Implement tests for *streamChat method
  });

  describe("default context length", () => {
    allModelProviders.map((modelProvider) => {
      const LLMClass = LLMClasses.find(
        (llm) => llm.providerName === modelProvider.id,
      );
      if (!LLMClass) {
        throw new Error(`did not find LLM provider for ${modelProvider.id}`);
      }
      const testContextLength = (llmInfo: LlmInfo) => () => {
        const llm = new LLMClass({ model: llmInfo.model });
        if (llmInfo.contextLength) {
          expect(llm.contextLength).toEqual(llmInfo.contextLength);
        } else {
          expect(llm.contextLength).toEqual(DEFAULT_CONTEXT_LENGTH);
        }
      };
      describe(`${modelProvider.id}`, () => {
        modelProvider.models.forEach((llmInfo) => {
          test(
            `should have correct context length for ${llmInfo.model}`,
            testContextLength(llmInfo),
          );
        });
      });
    });
  });
});
