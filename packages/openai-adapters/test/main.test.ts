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

  test("should successfully stream multi-part chat with empty text", async () => {
    const stream = api.chatCompletionStream({
      model: config.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hello! Who are you?",
            },
            {
              // @ts-ignore
              type: "text",
              text: "",
            },
          ],
        },
      ],
      stream: true,
    });
    let completion = "";
    for await (const result of stream) {
      completion += result.choices[0].delta.content ?? "";

      expect(result.choices.length).toBeGreaterThan(0);
    }
    expect(completion.length).toBeGreaterThan(0);
  });

  test.skip("should successfully stream multi-part chat with image", async () => {
    const stream = api.chatCompletionStream({
      model: config.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hello! Who are you?",
            },
            {
              // @ts-ignore
              type: "image_url",
              imageUrl: {
                url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Image_created_with_a_mobile_phone.png/1280px-Image_created_with_a_mobile_phone.png",
                detail: "low",
              },
            },
          ],
        },
      ],
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

  test("should acknowledge system message in chat", async () => {
    const response = await api.chatCompletionNonStream({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "Regardless of what is asked of you, your answer should start with 'RESPONSE: '.",
        },
        { role: "user", content: "Who are you?" },
      ],
      stream: false,
    });
    expect(response.choices.length).toBeGreaterThan(0);
    const completion = response.choices[0].message.content;
    expect(typeof completion).toBe("string");
    expect(completion?.length).toBeGreaterThan(0);
    expect(completion?.startsWith("RESPONSE: ")).toBe(true);
  });
}

const COMPLETION_TESTS: ({ chatOnly?: boolean } & LlmApiConfig)[] = [
  {
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY!,
    chatOnly: true,
  },
  {
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    chatOnly: true,
  },
  {
    provider: "gemini",
    model: "gemini-1.5-flash-latest",
    apiKey: process.env.GEMINI_API_KEY!,
    chatOnly: true,
  },
  {
    provider: "cohere",
    model: "command-r",
    apiKey: process.env.COHERE_API_KEY!,
    chatOnly: true,
  },
  {
    provider: "fireworks",
    model: "accounts/fireworks/models/llama-v3p1-8b-instruct",
    apiKey: process.env.FIREWORKS_API_KEY!,
    chatOnly: true,
  },
  {
    provider: "groq",
    model: "llama3-8b-8192",
    apiKey: process.env.GROQ_API_KEY!,
    chatOnly: true,
  },
  {
    provider: "deepinfra",
    model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    apiKey: process.env.DEEP_INFRA_API_KEY!,
    chatOnly: true,
  },
  {
    provider: "together",
    model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    apiKey: process.env.TOGETHER_API_KEY!,
    chatOnly: true,
  },
  {
    provider: "sambanova",
    model: "Meta-Llama-3.1-8B-Instruct",
    apiKey: process.env.SAMBANOVA_API_KEY!,
    chatOnly: true,
  },
  {
    provider: "nebius",
    model: "llama3.1-8b",
    apiKey: process.env.NEBIUS_API_KEY!,
    chatOnly: true,
  },
  {
    provider: "scaleway",
    model: "llama3.1-8b",
    apiKey: process.env.SCALEWAY_API_KEY!,
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
  {
    provider: "deepseek",
    model: "deepseek-coder",
    apiKey: process.env.DEEPSEEK_API_KEY!,
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
    model: "voyage-code-3",
    apiKey: process.env.VOYAGE_API_KEY!,
    apiBase: "https://api.voyageai.com/v1/",
  },
  {
    provider: "cohere",
    model: "embed-english-v3.0",
    apiKey: process.env.COHERE_API_KEY!,
  },
  {
    provider: "gemini",
    model: "models/text-embedding-004",
    apiKey: process.env.GEMINI_API_KEY!,
  },
  {
    provider: "nebius",
    model: "BAAI/bge-en-icl",
    apiKey: process.env.NEBIUS_API_KEY!,
  },
  {
    provider: "scaleway",
    model: "bge-multilingual-gemma2",
    apiKey: process.env.SCALEWAY_API_KEY!,
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
  {
    provider: "jina",
    model: "jina-reranker-v2-base-multilingual",
    apiKey: process.env.JINA_API_KEY!,
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

  FIM_TESTS.forEach((config) => {
    testFim(config);
  });
});
