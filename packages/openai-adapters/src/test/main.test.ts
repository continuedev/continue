import { ModelConfig } from "@continuedev/config-yaml";
import * as dotenv from "dotenv";
import { OpenAIApi } from "../apis/OpenAI.js";
import { constructLlmApi } from "../index.js";
import { getLlmApi, testChat, testEmbed, testFim } from "./util.js";

dotenv.config();

export interface TestConfigOptions {
  skipTools: boolean;
}

function testConfig(_config: ModelConfig & { options?: TestConfigOptions }) {
  const { options, ...config } = _config;
  const model = config.model;
  const api = getLlmApi({
    provider: config.provider as any,
    apiKey: config.apiKey,
    apiBase: config.apiBase,
    env: config.env,
  });

  if (
    ["chat", "summarize", "edit", "apply"].some((role) =>
      config.roles?.includes(role as any),
    )
  ) {
    testChat(api, model, options);
  }

  if (config.roles?.includes("embed")) {
    testEmbed(api, model);
  }
  if (config.roles?.includes("autocomplete")) {
    testFim(api, model);
  }
  
}
const TESTS: Omit<ModelConfig & { options?: TestConfigOptions }, "name">[] = [
    {
    provider: "llamastack",
    model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    apiBase: "http://localhost:8321/v1/openai/v1/",
    roles: ["apply", "chat", "edit"],
    options: { skipTools: false },
  },
  {
    provider: "llamastack",
    model: "all-MiniLM-L6-v2",
    apiBase: "http://localhost:8321/v1/openai/v1/",
    roles: ["embed"],
  },
    {
    provider: "llamastack",
    model: "qwen2.5-coder:1.5b",
    apiBase: "http://localhost:8321/v1/openai/v1/",
    roles: ["autocomplete"],
  },
];

TESTS.forEach((config) => {
  describe(`${config.provider}/${config.model}`, () => {
    testConfig({ name: config.model, ...config });
  });
});

describe("Configuration", () => {
  it("should configure OpenAI client with correct apiBase and apiKey", () => {
    const openai = constructLlmApi({
      provider: "openai",
      apiKey: "sk-xxx",
      apiBase: "http://localhost:8321/v1/openai/v1/",
    });

    expect((openai as OpenAIApi).openai.baseURL).toBe("http://localhost:8321/v1/openai/v1/");
    expect((openai as OpenAIApi).openai.apiKey).toBe("sk-xxx");
  });
});
