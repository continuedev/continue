import {
  FQSN,
  PackageIdentifier,
  PlatformClient,
  Registry,
  SecretResult,
  SecretType,
} from "../index.js";
import { resolveModelConnections } from "./connections.js";
import { unrollAssistantFromContent } from "./unroll.js";

const anthropicWork = {
  name: "anthropic-work",
  provider: "anthropic",
  apiKey: "${{ secrets.WORK_KEY }}",
  apiBase: "https://proxy.example.com/v1/",
  requestOptions: { headers: { "x-team": "core" }, timeout: 30 },
  env: { region: "us" },
};

describe("resolveModelConnections", () => {
  it("fills a model's connection settings from its instance", () => {
    const { models, errors } = resolveModelConnections(
      [
        {
          name: "Sonnet",
          model: "claude-sonnet-4-6",
          connection: "anthropic-work",
        },
      ],
      [anthropicWork],
    );
    expect(errors).toEqual([]);
    expect(models?.[0]).toEqual({
      name: "Sonnet",
      model: "claude-sonnet-4-6",
      connection: "anthropic-work",
      provider: "anthropic",
      apiKey: "${{ secrets.WORK_KEY }}",
      apiBase: "https://proxy.example.com/v1/",
      requestOptions: { headers: { "x-team": "core" }, timeout: 30 },
      env: { region: "us" },
    });
  });

  it("lets the model's own values win and merges env and headers", () => {
    const { models } = resolveModelConnections(
      [
        {
          name: "Opus",
          model: "claude-opus-4-8",
          connection: "anthropic-work",
          apiBase: "https://other.example.com/",
          env: { extra: true },
          requestOptions: { headers: { "x-model": "opus" } },
        },
      ],
      [anthropicWork],
    );
    expect(models?.[0]).toMatchObject({
      apiBase: "https://other.example.com/",
      env: { region: "us", extra: true },
      requestOptions: {
        timeout: 30,
        headers: { "x-team": "core", "x-model": "opus" },
      },
    });
  });

  it("leaves models without a connection untouched", () => {
    const plain = { name: "Local", provider: "ollama", model: "qwen3" };
    const { models, errors } = resolveModelConnections(
      [plain, null],
      [anthropicWork],
    );
    expect(models).toEqual([plain, null]);
    expect(errors).toEqual([]);
  });

  it("skips a model whose connection does not exist, with an error", () => {
    const { models, errors } = resolveModelConnections(
      [{ name: "Grok", model: "grok-5", connection: "xai" }],
      [anthropicWork],
    );
    expect(models).toEqual([null]);
    expect(errors[0].message).toMatch(/connection "xai".*not defined/);
    expect(errors[0].fatal).toBe(false);
  });

  it("skips a model whose provider contradicts its connection", () => {
    const { models, errors } = resolveModelConnections(
      [
        {
          name: "X",
          provider: "openai",
          model: "gpt-6",
          connection: "anthropic-work",
        },
      ],
      [anthropicWork],
    );
    expect(models).toEqual([null]);
    expect(errors[0].message).toMatch(
      /provider "openai".*"anthropic" provider/,
    );
  });
});

describe("unrolling a config whose models use connections", () => {
  const id: PackageIdentifier = {
    uriType: "file",
    fileUri: "/tmp/config.yaml",
  };
  const registry: Registry = {
    getContent: async () => {
      throw new Error("no blocks in this test");
    },
  };
  const secrets: Record<string, string> = { WORK_KEY: "sk-ant-work" };
  const platformClient: PlatformClient = {
    resolveFQSNs: async (
      fqsns: FQSN[],
    ): Promise<(SecretResult | undefined)[]> =>
      fqsns.map((fqsn) =>
        secrets[fqsn.secretName] === undefined
          ? undefined
          : {
              found: true,
              fqsn,
              value: secrets[fqsn.secretName],
              secretLocation: {
                secretType: SecretType.LocalEnv,
                secretName: fqsn.secretName,
              },
            },
      ),
  };

  it("parses a model with only a connection and renders the instance's secret", async () => {
    const yaml = `name: Cloud
version: 1.0.0
schema: v1
models:
  - name: Sonnet
    model: claude-sonnet-4-6
    connection: anthropic-work
    roles: [chat, edit]
`;
    const result = await unrollAssistantFromContent(id, yaml, registry, {
      renderSecrets: true,
      currentUserSlug: "",
      platformClient,
      providers: [anthropicWork],
    });
    expect(result.errors?.filter((e) => e.fatal)).toEqual([]);
    const model = result.config?.models?.[0];
    expect(model).toMatchObject({
      name: "Sonnet",
      provider: "anthropic",
      connection: "anthropic-work",
      apiKey: "sk-ant-work",
      apiBase: "https://proxy.example.com/v1/",
      roles: ["chat", "edit"],
    });
  });

  it("reports an unknown connection instead of failing the config", async () => {
    const yaml = `name: Cloud
version: 1.0.0
schema: v1
models:
  - name: Grok
    model: grok-5
    connection: xai
  - name: Local
    provider: ollama
    model: qwen3
`;
    const result = await unrollAssistantFromContent(id, yaml, registry, {
      renderSecrets: true,
      currentUserSlug: "",
      platformClient,
      providers: [anthropicWork],
    });
    expect(result.config?.models?.map((m) => m?.name ?? null)).toEqual([
      null,
      "Local",
    ]);
    expect(result.errors?.some((e) => /connection "xai"/.test(e.message))).toBe(
      true,
    );
  });
});
