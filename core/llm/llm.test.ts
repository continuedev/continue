import * as dotenv from "dotenv";

import { AssistantChatMessage, CompletionOptions } from "..";

import Anthropic from "./llms/Anthropic";
import Azure from "./llms/Azure";
import Gemini from "./llms/Gemini";
import Mistral from "./llms/Mistral";
import OpenAI from "./llms/OpenAI";

import { BaseLLM } from ".";

dotenv.config();

const COMPLETION_OPTIONS: Partial<CompletionOptions> = {
  // temperature: 0.5,
  topP: 1,
  topK: 40,
  presencePenalty: 0,
  frequencyPenalty: 0,
  // stop: ["\n"],
  // maxTokens: 5,
};

function testLLM(
  llm: BaseLLM,
  {
    skip,
    testFim,
    testToolCall,
    timeout,
  }: {
    skip?: boolean;
    testFim?: boolean;
    testToolCall?: boolean;
    timeout?: number;
  },
) {
  if (skip) {
    return;
  }

  beforeAll(() => {
    llm.completionOptions = { ...llm.completionOptions, ...COMPLETION_OPTIONS };
  });

  describe(llm.providerName + "/" + llm.model, () => {
    test(
      "Stream Chat works",
      async () => {
        let total = "";
        for await (const chunk of llm.streamChat(
          [{ role: "user", content: "Hi" }],
          new AbortController().signal,
        )) {
          total += chunk.content;
        }

        expect(total.length).toBeGreaterThan(0);
        return;
      },
      timeout,
    );

    test(
      "Stream Complete works",
      async () => {
        let total = "";
        for await (const chunk of llm.streamComplete(
          "Hi",
          new AbortController().signal,
        )) {
          total += chunk;
        }

        expect(total.length).toBeGreaterThan(0);
        return;
      },
      timeout,
    );

    test(
      "Complete works",
      async () => {
        const completion = await llm.complete(
          "Hi",
          new AbortController().signal,
        );

        expect(completion.length).toBeGreaterThan(0);
        return;
      },
      timeout,
    );

    if (testFim) {
      test(
        "FIM works",
        async () => {
          let total = "";
          for await (const chunk of llm.streamFim(
            "Hi",
            "name is ChatGPT.",
            new AbortController().signal,
          )) {
            total += chunk;
          }

          expect(total.length).toBeGreaterThan(0);
          return;
        },
        timeout,
      );
    }

    if (testToolCall) {
      test(
        "Tool Call works",
        async () => {
          let args = "";
          let isFirstChunk = true;
          for await (const chunk of llm.streamChat(
            [{ role: "user", content: "Hi, my name is Nate." }],
            new AbortController().signal,
            {
              tools: [
                {
                  displayTitle: "Say Hello",
                  function: {
                    name: "say_hello",
                    description: "Say Hello",
                    parameters: {
                      type: "object",
                      properties: {
                        name: {
                          type: "string",
                          description: "The name of the person to greet",
                        },
                      },
                    },
                  },
                  type: "function",
                  wouldLikeTo: "Say hello",
                  readonly: true,
                },
              ],
              toolChoice: {
                type: "function",
                function: {
                  name: "say_hello",
                },
              },
            },
          )) {
            const typedChunk = chunk as AssistantChatMessage;
            if (!typedChunk.toolCalls) {
              continue;
            }
            const toolCall = typedChunk.toolCalls[0];
            args += toolCall.function?.arguments ?? "";

            expect(chunk.role).toBe("assistant");
            expect(chunk.content).toBe("");
            expect(typedChunk.toolCalls).toHaveLength(1);

            if (isFirstChunk) {
              isFirstChunk = false;
              expect(toolCall.id).toBeDefined();
              expect(toolCall.function!.name).toBe("say_hello");
            }
          }

          const parsedArgs = JSON.parse(args);
          expect(parsedArgs.name).toBe("Nate");
        },
        timeout,
      );
    }
  });
}

describe("LLM", () => {
  if (process.env.IGNORE_API_KEY_TESTS === "true") {
    test("Skipping API key tests", () => {
      console.log(
        "Skipping API key tests due to IGNORE_API_KEY_TESTS being set",
      );
    });
    return;
  }

  testLLM(
    new Anthropic({
      model: "claude-3-5-sonnet-latest",
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),
    {
      skip: false,
      testToolCall: true,
    },
  );
  testLLM(new OpenAI({ apiKey: process.env.OPENAI_API_KEY, model: "gpt-4o" }), {
    skip: false,
    testToolCall: true,
  });
  testLLM(
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY, model: "o1-preview" }),
    { skip: false, timeout: 20000 },
  );
  testLLM(new OpenAI({ apiKey: process.env.OPENAI_API_KEY, model: "o1" }), {
    skip: false,
  });
  testLLM(
    new Gemini({
      model: "gemini-2.0-flash-exp",
      apiKey: process.env.GEMINI_API_KEY,
    }),
    { skip: false },
  );
  testLLM(
    new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
      model: "codestral-latest",
    }),
    { testFim: true, skip: false },
  );
  testLLM(
    new Azure({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      model: "gpt-4o",
      apiVersion: "2024-05-01-preview",
      apiBase: "https://continue-azure-openai-instance.openai.azure.com",
      deployment: "azure-openai-deployment",
      apiType: "azure-openai",
    }),
    { testFim: false, skip: false, timeout: 20000 },
  );
  testLLM(
    new Azure({
      apiKey: process.env.AZURE_FOUNDRY_API_KEY,
      model: "codestral-latest",
      apiBase:
        "https://codestral-2501-continue-testing.eastus.models.ai.azure.com",
      apiType: "azure-foundry",
    }),
    { testFim: false, skip: false, timeout: 20000 },
  );
});
