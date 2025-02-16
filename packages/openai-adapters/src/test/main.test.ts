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
];

describe("should successfully call all adapters", () => {
  TESTS.forEach((config) => {
    testConfig({ name: config.model, ...config });
  });
});
