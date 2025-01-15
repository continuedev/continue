import * as dotenv from "dotenv";

import { CompletionOptions } from "..";

import Anthropic from "./llms/Anthropic";
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
  { skip, testFim }: { skip?: boolean; testFim?: boolean },
) {
  if (skip) {
    return;
  }

  beforeAll(() => {
    llm.completionOptions = { ...llm.completionOptions, ...COMPLETION_OPTIONS };
  });

  describe(llm.providerName + "/" + llm.model, () => {
    test("Stream Chat works", async () => {
      let total = "";
      for await (const chunk of llm.streamChat(
        [{ role: "user", content: "Hi" }],
        new AbortController().signal,
      )) {
        total += chunk.content;
      }

      expect(total.length).toBeGreaterThan(0);
      return;
    });

    test("Stream Complete works", async () => {
      let total = "";
      for await (const chunk of llm.streamComplete(
        "Hi",
        new AbortController().signal,
      )) {
        total += chunk;
      }

      expect(total.length).toBeGreaterThan(0);
      return;
    });

    test("Complete works", async () => {
      const completion = await llm.complete("Hi", new AbortController().signal);

      expect(completion.length).toBeGreaterThan(0);
      return;
    });

    if (testFim) {
      test("FIM works", async () => {
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
      });
    }
  });
}

describe("LLM", () => {
  testLLM(
    new Anthropic({
      model: "claude-3-5-sonnet-latest",
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),
    { skip: false },
  );
  testLLM(
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY, model: "gpt-3.5-turbo" }),
    { skip: false },
  );
  testLLM(
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY, model: "o1-preview" }),
    { skip: false },
  );
  // testLLM(new OpenAI({ apiKey: process.env.OPENAI_API_KEY, model: "o1" }), {
  //   skip: false,
  // });
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
});
