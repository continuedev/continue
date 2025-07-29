import { ModelConfig } from "@continuedev/config-yaml";
import * as dotenv from "dotenv";
import { vi } from "vitest";
import { DEEPSEEK_API_BASE } from "../apis/DeepSeek.js";
import { INCEPTION_API_BASE } from "../apis/Inception.js";
import { OpenAIApi } from "../apis/OpenAI.js";
import { constructLlmApi } from "../index.js";
import { getLlmApi, testChat, testEmbed, testFim, testRerank } from "./util.js";

dotenv.config();

export interface TestConfigOptions {
  skipTools: boolean;
  expectUsage?: boolean;
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

  if (config.roles?.includes("rerank")) {
    testRerank(api, model);
  }

  if (config.roles?.includes("autocomplete")) {
    testFim(api, model);
  }
}

const TESTS: Omit<ModelConfig & { options?: TestConfigOptions }, "name">[] = [
  {
    provider: "openai",
    model: "gpt-4o",
    apiKey: process.env.OPENAI_API_KEY!,
    roles: ["chat"],
  },
  {
    provider: "anthropic",
    model: "claude-3-5-haiku-latest",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    roles: ["chat"],
    options: {
      skipTools: false,
      expectUsage: true,
    },
  },
  {
    provider: "gemini",
    model: "gemini-1.5-flash-latest",
    apiKey: process.env.GEMINI_API_KEY!,
    roles: ["chat"],
  },
  // {
  //   provider: "mistral",
  //   model: "codestral-latest",
  //   apiKey: process.env.MISTRAL_API_KEY!,
  //   apiBase: "https://api.mistral.ai/v1",
  //   roles: ["autocomplete"],
  // },
  // {
  //   provider: "deepseek",
  //   model: "deepseek-coder",
  //   apiKey: process.env.DEEPSEEK_API_KEY!,
  //   roles: ["autocomplete"],
  // },
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
  //   model: "embed-v4.0",
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
  //   model: "rerank-v3.5",
  //   apiKey: process.env.COHERE_API_KEY!,
  //   roles: ["rerank"],
  // },
  {
    provider: "azure",
    model: "gpt-4.1",
    apiBase: "https://continue-openai.openai.azure.com",
    apiKey: process.env.AZURE_OPENAI_GPT41_API_KEY,
    roles: ["chat"],
    env: {
      deployment: "gpt-4.1",
      apiVersion: "2024-02-15-preview",
      apiType: "azure-openai",
    },
  },
];

if (process.env.IGNORE_API_KEY_TESTS === "true") {
  test("Skipping API key tests", () => {
    console.log("Skipping API key tests due to IGNORE_API_KEY_TESTS being set");
  });
} else {
  TESTS.forEach((config) => {
    describe(`${config.provider}/${config.model}`, () => {
      vi.setConfig({ testTimeout: 30000 });
      testConfig({ name: config.model, ...config });
    });
  });
}

describe("Configuration", () => {
  it("should configure DeepSeek OpenAI client with correct apiBase and apiKey", () => {
    const deepseek = constructLlmApi({
      provider: "deepseek",
      apiKey: "sk-xxx",
    });

    expect((deepseek as OpenAIApi).openai.baseURL).toBe(DEEPSEEK_API_BASE);
    expect((deepseek as OpenAIApi).openai.apiKey).toBe("sk-xxx");

    const deepseek2 = constructLlmApi({
      provider: "deepseek",
      apiKey: "sk-xxx",
      apiBase: "https://api.example.com",
    });
    expect((deepseek2 as OpenAIApi).openai.baseURL).toBe(
      "https://api.example.com",
    );
  });

  it("should configure Inception OpenAI client with correct apiBase and apiKey", () => {
    const inception = constructLlmApi({
      provider: "inception",
      apiKey: "sk-xxx",
    });

    expect((inception as OpenAIApi).openai.baseURL).toBe(INCEPTION_API_BASE);
    expect((inception as OpenAIApi).openai.apiKey).toBe("sk-xxx");

    const inception2 = constructLlmApi({
      provider: "inception",
      apiKey: "sk-xxx",
      apiBase: "https://api.example.com",
    });
    expect((inception2 as OpenAIApi).openai.baseURL).toBe(
      "https://api.example.com",
    );
  });

  it("should configure Azure OpenAI client with root URL and trailing slash", () => {
    const azure = constructLlmApi({
      provider: "azure",
      apiKey: "sk-xxx",
      apiBase: "https://test-azure-openai.azure.com/",
      env: {
        deployment: "gpt-4.1",
        apiType: "azure-openai",
        apiVersion: "2023-05-15",
      },
    });

    // The Azure client modifies the baseURL to include the deployment
    expect((azure as OpenAIApi).openai.baseURL).toBe(
      "https://test-azure-openai.azure.com/openai/deployments/gpt-4.1",
    );
    expect((azure as OpenAIApi).openai.apiKey).toBe("sk-xxx");
  });

  it("should configure Azure OpenAI client with path and trailing slash", () => {
    const azure = constructLlmApi({
      provider: "azure",
      apiKey: "sk-xxx",
      apiBase: "https://test-azure-openai.azure.com/v1/",
      env: {
        deployment: "gpt-4.1",
        apiType: "azure-openai",
        apiVersion: "2023-05-15",
      },
    });

    // The Azure client modifies the baseURL to include the deployment
    expect((azure as OpenAIApi).openai.baseURL).toBe(
      "https://test-azure-openai.azure.com/v1/openai/deployments/gpt-4.1",
    );
    expect((azure as OpenAIApi).openai.apiKey).toBe("sk-xxx");
  });

  it("should configure Azure OpenAI client with root URL and no trailing slash", () => {
    const azure = constructLlmApi({
      provider: "azure",
      apiKey: "sk-xxx",
      apiBase: "https://test-azure-openai.azure.com",
      env: {
        deployment: "gpt-4.1",
        apiType: "azure-openai",
        apiVersion: "2023-05-15",
      },
    });

    // The Azure client modifies the baseURL to include the deployment
    expect((azure as OpenAIApi).openai.baseURL).toBe(
      "https://test-azure-openai.azure.com/openai/deployments/gpt-4.1",
    );
    expect((azure as OpenAIApi).openai.apiKey).toBe("sk-xxx");
  });

  it("should configure Azure OpenAI client with path and no trailing slash", () => {
    const azure = constructLlmApi({
      provider: "azure",
      apiKey: "sk-xxx",
      apiBase: "https://test-azure-openai.azure.com/v1",
      env: {
        deployment: "gpt-4.1",
        apiType: "azure-openai",
        apiVersion: "2023-05-15",
      },
    });

    // The Azure client modifies the baseURL to include the deployment
    expect((azure as OpenAIApi).openai.baseURL).toBe(
      "https://test-azure-openai.azure.com/v1/openai/deployments/gpt-4.1",
    );
    expect((azure as OpenAIApi).openai.apiKey).toBe("sk-xxx");
  });
});
