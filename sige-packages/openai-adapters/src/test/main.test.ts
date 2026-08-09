import { ModelConfig } from "@continuedev/config-yaml";
import * as dotenv from "dotenv";
import { vi } from "vitest";
import { BedrockApi } from "../apis/Bedrock.js";
import { DEEPSEEK_API_BASE } from "../apis/DeepSeek.js";
import { INCEPTION_API_BASE } from "../apis/Inception.js";
import { OpenAIApi } from "../apis/OpenAI.js";
import { constructLlmApi } from "../index.js";
import { getLlmApi, testChat, testEmbed, testFim, testRerank } from "./util.js";

dotenv.config();

export interface TestConfigOptions {
  skipTools: boolean;
  expectUsage?: boolean;
  skipSystemMessage?: boolean;
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
    options: {
      skipTools: false,
      expectUsage: true,
    },
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY!,
    roles: ["chat"],
    options: {
      skipTools: false,
      expectUsage: true,
    },
  },
  {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    roles: ["chat"],
    options: {
      skipTools: false,
      expectUsage: true,
    },
  },
  {
    provider: "gemini",
    model: "gemini-2.5-pro",
    apiKey: process.env.GEMINI_API_KEY!,
    roles: ["chat"],
    options: {
      skipTools: false,
      expectUsage: true,
    },
  },
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY!,
    roles: ["chat"],
    options: {
      skipTools: false,
      expectUsage: true,
    },
  },
  {
    provider: "mistral",
    model: "codestral-latest",
    apiKey: process.env.MISTRAL_API_KEY!,
    roles: ["chat", "autocomplete"],
    options: {
      skipTools: false,
      expectUsage: true,
    },
  },
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
  {
    provider: "relace",
    model: "instant-apply",
    apiKey: process.env.RELACE_API_KEY!,
    roles: ["chat"],
    options: {
      skipTools: true,
      expectUsage: true,
      skipSystemMessage: true,
    },
  },
  {
    provider: "inception",
    model: "mercury-coder",
    apiKey: process.env.INCEPTION_API_KEY!,
    roles: ["chat"],
    options: {
      skipTools: false,
      expectUsage: true,
    },
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
  // {
  //   provider: "bedrock",
  //   model: "us.anthropic.claude-3-5-sonnet-20240620-v1:0",
  //   apiKey: process.env.BEDROCK_API_KEY!,
  //   roles: ["chat"],
  //   env: {
  //     region: "us-east-1",
  //   },
  //   options: {
  //     skipTools: true,
  //     expectUsage: false,
  //   },
  // },
];

if (process.env.IGNORE_API_KEY_TESTS === "true") {
  test("Skipping API key tests", () => {
    console.log("Skipping API key tests due to IGNORE_API_KEY_TESTS being set");
  });
} else {
  TESTS.forEach((config) => {
    // Skip tests that don't have API keys configured
    if (!config.apiKey) {
      return;
    }
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

  describe("ollama api base", () => {
    it('should have correct default API base for "ollama"', () => {
      const ollama = constructLlmApi({
        provider: "ollama",
      });

      expect((ollama as OpenAIApi).openai.baseURL).toBe(
        "http://localhost:11434/v1/",
      );
    });
    it('should append /v1 to apiBase for "ollama"', () => {
      const ollama = constructLlmApi({
        provider: "ollama",
        apiBase: "http://localhost:123",
      });

      expect((ollama as OpenAIApi).openai.baseURL).toBe(
        "http://localhost:123/v1/",
      );
    });
    it("should not reappend /v1 to apibase for ollama if it is already present", () => {
      const ollama = constructLlmApi({
        provider: "ollama",
        apiBase: "http://localhost:123/v1/",
      });

      expect((ollama as OpenAIApi).openai.baseURL).toBe(
        "http://localhost:123/v1/",
      );
    });
    it("should append v1 if apiBase is like myhostv1/", () => {
      const ollama = constructLlmApi({
        provider: "ollama",
        apiBase: "https://myhostv1/",
      });
      expect((ollama as OpenAIApi).openai.baseURL).toBe("https://myhostv1/v1/");
    });
    it("should preserve query params and append v1 in apibase", () => {
      const ollama = constructLlmApi({
        provider: "ollama",
        apiBase: "https://test.com:123/ollama-server?x=1",
      });
      expect((ollama as OpenAIApi).openai.baseURL).toBe(
        "https://test.com:123/ollama-server/v1/?x=1",
      );
    });
  });

  describe("bedrock authentication", () => {
    it("should configure Bedrock with API key authentication", () => {
      const bedrock = constructLlmApi({
        provider: "bedrock",
        apiKey: "test-api-key",
        env: {
          region: "us-east-1",
        },
      });

      expect(bedrock).toBeInstanceOf(BedrockApi);
    });

    it("should configure Bedrock with IAM credentials", () => {
      const bedrock = constructLlmApi({
        provider: "bedrock",
        env: {
          region: "us-west-2",
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
        },
      });

      expect(bedrock).toBeInstanceOf(BedrockApi);
    });

    it("should configure Bedrock with AWS profile", () => {
      const bedrock = constructLlmApi({
        provider: "bedrock",
        env: {
          region: "eu-west-1",
          profile: "my-profile",
        },
      });

      expect(bedrock).toBeInstanceOf(BedrockApi);
    });

    it("should throw error if only accessKeyId is provided", () => {
      expect(() => {
        constructLlmApi({
          provider: "bedrock",
          env: {
            region: "us-east-1",
            accessKeyId: "test-access-key",
          },
        });
      }).toThrow("secretAccessKey is required");
    });

    it("should throw error if only secretAccessKey is provided", () => {
      expect(() => {
        constructLlmApi({
          provider: "bedrock",
          env: {
            region: "us-east-1",
            secretAccessKey: "test-secret-key",
          },
        });
      }).toThrow("accessKeyId is required");
    });
  });
});
