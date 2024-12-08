import * as dotenv from "dotenv";

import { CompletionOptions } from "..";
import { BaseLLM } from ".";
import OpenAI from "./llms/OpenAI";

dotenv.config();

const COMPLETION_OPTIONS: Partial<CompletionOptions> = {
  temperature: 0.5,
  topP: 1,
  topK: 40,
  presencePenalty: 0,
  frequencyPenalty: 0,
  // stop: ["\n"],
  // maxTokens: 5,
};

function testLLM(llm: BaseLLM) {
  beforeAll(() => {
    llm.completionOptions = { ...llm.completionOptions, ...COMPLETION_OPTIONS };
  });

  describe(llm.providerName, () => {
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
  });
}

describe.skip("LLM", () => {
  // testLLM(
  //   new FreeTrial({
  //     model: "gpt-3.5-turbo",
  //   }),
  // );
  // testLLM(
  //   new Anthropic({
  //     model: "claude-2",
  //     apiKey: process.env.ANTHROPIC_API_KEY,
  //   }),
  // );
  testLLM(
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY, model: "gpt-3.5-turbo" }),
  );
  // TODO: Fix Replicate
  // testLLM(
  //   new Replicate({
  //     apiKey: process.env.REPLICATE_API_KEY,
  //     model: "codellama-7b",
  //   })
  // );
  // testLLM(new LMStudio({ model: "codellama-7b" }));
  // testLLM(new Ollama({ model: "codellama-7b" }));
  // testLLM(
  //   new Together({
  //     apiKey: process.env.TOGETHER_API_KEY,
  //     model: "codellama-7b",
  //   })
  // );
  // testLLM(new LlamaCpp({ model: "deepseek-7b" }));
  // testLLM(new Llamafile({ model: "mistral-7b" }));
  // TODO: Test these
  // testLLM(new TextGenWebUI({ model: "codellama-7b" }));
  // testLLM(new HuggingFaceTGI({ model: "codellama-7b" }));
  // testLLM(new HuggingFaceInferenceAPI({ model: "codellama-7b" }));
  // testLLM(
  //   new Gemini({
  //     model: "gemini-pro",
  //     //   model: "chat-bison-001",
  //     apiKey: process.env.GOOGLE_PALM_API_KEY,
  //   })
  // );
  // testLLM(
  //   new Gemini({ model: "gemini-pro", apiKey: process.env.GOOGLE_PALM_API_KEY })
  // );
  // testLLM(
  //   new Mistral({ apiKey: process.env.MISTRAL_API_KEY, model: "mistral-small" })
  // );
  // testLLM(
  //   new Flowise({ apiKey: process.env.FLOWISE_API_KEY, model: "gpt-3.5-turbo" })
  // );
  // testLLM(
  //   new Nebius({ apiKey: process.env.NEBIUS_API_KEY, model: "llama3.1-8b" })
  // );
});
