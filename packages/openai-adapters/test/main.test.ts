import * as dotenv from "dotenv";
import { constructLlmApi, LlmApiConfig } from "../src/index.js";

dotenv.config();

function testEmbed(config: LlmApiConfig) {
  test("should successfully embed", async () => {
    const api = constructLlmApi(config);

    const response = await api.embed({
      model: config.model,
      input: ["This is a test", "Hello world!"],
    });
    expect(response.model).toBe(config.model);
    expect(response.object).toBe("list");
    expect(response.data.length).toEqual(2);
    response.data.forEach((val, index) => {
      expect(val.index).toBe(index);
      expect(val.object).toBe("embedding");
      expect(val.embedding.some((v) => typeof v !== "number")).toBe(false);
    });
  });
}

function testRerank(config: LlmApiConfig) {
  test("should successfully rerank", async () => {
    const api = constructLlmApi(config);

    const response = await api.rerank({
      model: config.model,
      query: "What is the capital of spain?",
      documents: [
        "The capital of spain is Madrid",
        "The largest breed of dog is the Great Dane",
      ],
    });
    expect(response.model).toBe(config.model);
    expect(response.object).toBe("list");
    expect(response.data.length).toEqual(2);
    response.data.forEach((val, index) => {
      expect(val.index).toBe(index);
      expect(typeof val.relevance_score).toBe("number");
    });
    expect(response.data[0].relevance_score).toBeGreaterThan(
      response.data[1].relevance_score,
    );
  });
}

function testFim(config: LlmApiConfig) {
  test("should successfully fim", async () => {
    const api = constructLlmApi(config);

    const response = api.fimStream({
      model: config.model,
      prompt: "This is a ",
      suffix: " .",
      stream: true,
    });

    let completion = "";
    for await (const result of response) {
      expect(result.choices.length).toBeGreaterThan(0);
      expect(typeof result.choices[0].delta.content).toBe("string");

      completion += result.choices[0].delta.content;
    }

    expect(completion.length).toBeGreaterThan(0);
  });
}

function testConfig(config: LlmApiConfig, chatOnly: boolean = false) {
  const api = constructLlmApi(config);

  if (!chatOnly) {
    test("should successfully stream complete", async () => {
      const stream = api.completionStream({
        model: config.model,
        prompt: "Hello! Who are you?",
        stream: true,
      });
      let completion = "";
      for await (const result of stream) {
        completion += result.choices[0].text ?? "";

        expect(typeof result.choices[0].text).toBe("string");
        expect(result.choices.length).toBeGreaterThan(0);
      }
      expect(completion.length).toBeGreaterThan(0);
    });

    test("should successfully non-stream complete", async () => {
      const response = await api.completionNonStream({
        model: config.model,
        prompt: "Hello! Who are you?",
        stream: false,
      });

      expect(response.choices.length).toBeGreaterThan(0);

      const completion = response.choices[0].text;
      expect(typeof completion).toBe("string");
      expect(completion.length).toBeGreaterThan(0);
    });
  }

  test("should successfully stream chat", async () => {
    const stream = api.chatCompletionStream({
      model: config.model,
      messages: [{ role: "user", content: "Hello! Who are you?" }],
      stream: true,
    });
    let completion = "";
    for await (const result of stream) {
      completion += result.choices[0].delta.content ?? "";

      expect(result.choices.length).toBeGreaterThan(0);
    }
    expect(completion.length).toBeGreaterThan(0);
  });

  test("should successfully non-stream chat", async () => {
    const response = await api.chatCompletionNonStream({
      model: config.model,
      messages: [{ role: "user", content: "Hello! Who are you?" }],
      stream: false,
    });

    expect(response.choices.length).toBeGreaterThan(0);

    const completion = response.choices[0].message.content;
    expect(typeof completion).toBe("string");
    expect(completion?.length).toBeGreaterThan(0);
  });
}

const COMPLETION_TESTS: ({ chatOnly?: boolean } & LlmApiConfig)[] = [
  {
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY!,
    chatOnly: true,
  },
];

const FIM_TESTS: LlmApiConfig[] = [
  {
    provider: "openai",
    model: "codestral-latest",
    apiKey: process.env.MISTRAL_API_KEY!,
    apiBase: "https://api.mistral.ai/v1",
  },
];

const EMBEDDINGS_TESTS: LlmApiConfig[] = [
  {
    provider: "openai",
    model: "text-embedding-3-small",
    apiKey: process.env.OPENAI_API_KEY!,
  },
  {
    provider: "openai",
    model: "voyage-code-2",
    apiKey: process.env.VOYAGE_API_KEY!,
    apiBase: "https://api.voyageai.com/v1/",
  },
  {
    provider: "cohere",
    model: "embed-english-v3.0",
    apiKey: process.env.COHERE_API_KEY!,
  },
];

const RERANK_TESTS: LlmApiConfig[] = [
  {
    provider: "openai",
    model: "rerank-lite-1",
    apiKey: process.env.VOYAGE_API_KEY!,
    apiBase: "https://api.voyageai.com/v1/",
  },
  {
    provider: "cohere",
    model: "rerank-english-v3.0",
    apiKey: process.env.COHERE_API_KEY!,
  },
];

describe("should successfully call all adapters", () => {
  COMPLETION_TESTS.forEach((config) => {
    const { chatOnly, ...rest } = config;
    testConfig(rest, chatOnly);
  });

  EMBEDDINGS_TESTS.forEach((config) => {
    testEmbed(config);
  });

  RERANK_TESTS.forEach((config) => {
    testRerank(config);
  });

  // FIM_TESTS.forEach((config) => {
  //   testFim(config);
  // });
});
