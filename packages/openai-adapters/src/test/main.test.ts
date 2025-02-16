import { ModelConfig } from "@continuedev/config-yaml";
import * as dotenv from "dotenv";
import { getLlmApi, testChat, testCompletion, testEmbed } from "./util.js";

dotenv.config();

function testConfig(config: ModelConfig) {
  const model = config.model;
  const api = getLlmApi({
    provider: config.provider as any,
    apiKey: config.apiKey,
    apiBase: config.apiBase,
  });

  if (false) {
    testCompletion(api, model);
  }

  if (
    ["chat", "summarize", "edit", "apply"].some((role) =>
      config.roles?.includes(role as any),
    )
  ) {
    testChat(api, model);
  }

  if (config.roles?.includes("embed")) {
    testEmbed(api, model);
  }

  if (config.roles?.includes("embed")) {
    testEmbed(api, model);
  }
}

const TESTS: Omit<ModelConfig, "name">[] = [
  {
    provider: "openai",
    model: "gpt-4o",
    apiKey: process.env.OPENAI_API_KEY!,
    roles: ["chat"],
  },
  {
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    roles: ["chat"],
  },
  {
    provider: "gemini",
    model: "gemini-1.5-flash-latest",
    apiKey: process.env.GEMINI_API_KEY!,
    roles: ["chat"],
  },
  // {
  //   provider: "cohere",
  //   model: "command-r",
  //   apiKey: process.env.COHERE_API_KEY!,
  //   roles: ["chat"],
  // },
  // {
  //   provider: "fireworks",
  //   model: "accounts/fireworks/models/llama-v3p1-8b-instruct",
  //   apiKey: process.env.FIREWORKS_API_KEY!,
  //   roles: ["chat"],
  // },
  // {
  //   provider: "groq",
  //   model: "llama3-8b-8192",
  //   apiKey: process.env.GROQ_API_KEY!,
  //   roles: ["chat"],
  // },
  // {
  //   provider: "deepinfra",
  //   model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
  //   apiKey: process.env.DEEP_INFRA_API_KEY!,
  //   roles: ["chat"],
  // },
  // {
  //   provider: "together",
  //   model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  //   apiKey: process.env.TOGETHER_API_KEY!,
  //   roles: ["chat"],
  // },
  // {
  //   provider: "novita",
  //   model: "meta-llama/llama-3.1-8b-instruct",
  //   apiKey: process.env.NOVITA_API_KEY!,
  //   roles: ["chat"],
  // },
  // {
  //   provider: "sambanova",
  //   model: "Meta-Llama-3.1-8B-Instruct",
  //   apiKey: process.env.SAMBANOVA_API_KEY!,
  //   roles: ["chat"],
  // },
  // {
  //   provider: "nebius",
  //   model: "llama3.1-8b",
  //   apiKey: process.env.NEBIUS_API_KEY!,
  //   roles: ["chat"],
  // },
  // {
  //   provider: "scaleway",
  //   model: "llama3.1-8b",
  //   apiKey: process.env.SCALEWAY_API_KEY!,
  //   roles: ["chat"],
  // },
  {
    provider: "mistral",
    model: "codestral-latest",
    apiKey: process.env.MISTRAL_API_KEY!,
    apiBase: "https://api.mistral.ai/v1",
    roles: ["autocomplete"],
  },
  {
    provider: "deepseek",
    model: "deepseek-coder",
    apiKey: process.env.DEEPSEEK_API_KEY!,
    roles: ["autocomplete"],
  },
  {
    provider: "openai",
    model: "text-embedding-3-small",
    apiKey: process.env.OPENAI_API_KEY!,
    roles: ["embed"],
  },
  {
    provider: "voyage",
    model: "voyage-code-3",
    apiKey: process.env.VOYAGE_API_KEY!,
    roles: ["embed"],
  },
  // {
  //   provider: "cohere",
  //   model: "embed-english-v3.0",
  //   apiKey: process.env.COHERE_API_KEY!,
  //   roles: ["embed"],
  // },
  // {
  //   provider: "gemini",
  //   model: "models/text-embedding-004",
  //   apiKey: process.env.GEMINI_API_KEY!,
  //   roles: ["embed"],
  // },
  // {
  //   provider: "nebius",
  //   model: "BAAI/bge-en-icl",
  //   apiKey: process.env.NEBIUS_API_KEY!,
  //   roles: ["embed"],
  // },
  // {
  //   provider: "scaleway",
  //   model: "bge-multilingual-gemma2",
  //   apiKey: process.env.SCALEWAY_API_KEY!,
  //   roles: ["embed"],
  // },
  {
    provider: "voyage",
    model: "rerank-lite-1",
    apiKey: process.env.VOYAGE_API_KEY!,
    roles: ["rerank"],
  },
  // {
  //   provider: "cohere",
  //   model: "rerank-english-v3.0",
  //   apiKey: process.env.COHERE_API_KEY!,
  //   roles: ["rerank"],
  // },
  // {
  //   provider: "jina",
  //   model: "jina-reranker-v2-base-multilingual",
  //   apiKey: process.env.JINA_API_KEY!,
  //   roles: ["rerank"],
  // },
];

describe("should successfully call all adapters", () => {
  TESTS.forEach((config) => {
    testConfig({ name: config.model, ...config });
  });
});
