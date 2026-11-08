import {
  CatalogModel,
  FQSN,
  modelsFileSchema,
  PackageIdentifier,
  PlatformClient,
  Registry,
  SecretResult,
  SecretType,
} from "../index.js";
import {
  mergeModelLayers,
  parseCatalogRef,
  resolveCatalogModels,
} from "./catalog.js";
import { unrollAssistantFromContent } from "./unroll.js";

const qwen: CatalogModel = {
  name: "Qwen3.8 Flash",
  connection: "strata",
  model: "qwen3.8-flash-next-nvfp4-nvfp4",
  contextLength: 524288,
  capabilities: ["tool_use"],
  defaultCompletionOptions: { maxTokens: 8192, temperature: 1.0 },
  variants: {
    plan: {
      requestOptions: { extraBodyProperties: { reasoning_effort: "xhigh" } },
    },
    act: {
      defaultCompletionOptions: { temperature: 0.6 },
      requestOptions: { extraBodyProperties: { reasoning_effort: "low" } },
    },
  },
};
const sonnet: CatalogModel = {
  name: "Claude Sonnet",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  apiKey: "${{ secrets.ANTHROPIC_KEY }}",
};

describe("parseCatalogRef", () => {
  it("splits a variant off at the last #", () => {
    expect(parseCatalogRef("Qwen3.8 Flash#act")).toEqual({
      name: "Qwen3.8 Flash",
      variant: "act",
    });
    expect(parseCatalogRef("C# helper#fast")).toEqual({
      name: "C# helper",
      variant: "fast",
    });
    expect(parseCatalogRef("Plain")).toEqual({ name: "Plain" });
    expect(parseCatalogRef("Trailing#")).toEqual({ name: "Trailing#" });
  });
});

describe("mergeModelLayers", () => {
  it("merges objects key by key and replaces scalars and lists", () => {
    expect(
      mergeModelLayers(
        {
          a: 1,
          list: [1, 2],
          opts: { x: 1, deep: { y: 1, z: 1 } },
        },
        { list: [3], opts: { deep: { y: 2 } } },
        { a: 2, opts: { w: 4 } },
      ),
    ).toEqual({
      a: 2,
      list: [3],
      opts: { x: 1, w: 4, deep: { y: 2, z: 1 } },
    });
  });
});

describe("resolveCatalogModels", () => {
  it("expands from: entries: catalog, then variant, then the config's fields", () => {
    const { models, errors } = resolveCatalogModels(
      [
        { from: "Qwen3.8 Flash#act", roles: ["chat", "edit"] },
        { from: "Qwen3.8 Flash", name: "Qwen (planning)", roles: ["chat"] },
      ],
      [qwen],
    );
    expect(errors).toEqual([]);
    expect(models?.[0]).toEqual({
      name: "Qwen3.8 Flash#act",
      connection: "strata",
      model: "qwen3.8-flash-next-nvfp4-nvfp4",
      contextLength: 524288,
      capabilities: ["tool_use"],
      defaultCompletionOptions: { maxTokens: 8192, temperature: 0.6 },
      requestOptions: { extraBodyProperties: { reasoning_effort: "low" } },
      roles: ["chat", "edit"],
    });
    // The config's own name wins; variants never leak into a config model
    expect(models?.[1]).toMatchObject({ name: "Qwen (planning)" });
    expect(models?.[1]).not.toHaveProperty("variants");
  });

  it("adds the catalog models that modeModels picks and the list lacks", () => {
    const { models } = resolveCatalogModels(
      [{ name: "Local", provider: "ollama", model: "qwen3" }],
      [qwen, sonnet],
      {
        plan: { model: "Claude Sonnet" },
        agent: { model: "Qwen3.8 Flash#act", models: ["Local"] },
      },
    );
    expect(models?.map((m: any) => m.name)).toEqual([
      "Local",
      "Claude Sonnet",
      "Qwen3.8 Flash#act",
    ]);
    expect(models?.[1]).toMatchObject({ roles: ["chat"] });
  });

  it("skips an unknown model or variant with a non-fatal error", () => {
    const { models, errors } = resolveCatalogModels(
      [
        { from: "Nope" },
        { from: "Qwen3.8 Flash#fast" },
        { from: "Qwen3.8 Flash" },
      ],
      [qwen],
    );
    expect(models?.map((m: any) => m?.name ?? null)).toEqual([
      null,
      null,
      "Qwen3.8 Flash",
    ]);
    expect(errors.map((e) => e.fatal)).toEqual([false, false]);
    expect(errors[0].message).toMatch(/"Nope" is not a model in models\.yaml/);
    expect(errors[1].message).toMatch(/no variant "fast" \(it has plan, act\)/);
  });

  it("keeps routes on the resolved model for the runtime", () => {
    const { models } = resolveCatalogModels(
      [{ from: "Claude Sonnet" }],
      [
        {
          ...sonnet,
          routes: [
            {
              connection: "bedrock-us",
              model: "us.anthropic.claude-sonnet-4-6",
            },
          ],
        },
      ],
    );
    expect(models?.[0]).toMatchObject({
      routes: [
        { connection: "bedrock-us", model: "us.anthropic.claude-sonnet-4-6" },
      ],
    });
  });

  it("without a catalog, reports from: entries and leaves the rest", () => {
    const { models, errors } = resolveCatalogModels(
      [
        { from: "Qwen3.8 Flash" },
        { name: "X", provider: "openai", model: "x" },
      ],
      undefined,
    );
    expect(models?.map((m: any) => m?.name ?? null)).toEqual([null, "X"]);
    expect(errors).toHaveLength(1);
  });
});

describe("modelsFileSchema", () => {
  it("parses a catalog with variants and routes", () => {
    const parsed = modelsFileSchema.parse({
      models: [qwen, { ...sonnet, routes: [{ connection: "bedrock-us" }] }],
    });
    expect(parsed.models).toHaveLength(2);
    expect(parsed.models[0].variants?.act).toBeDefined();
  });

  it("refuses a variant that changes which model it is", () => {
    const result = modelsFileSchema.safeParse({
      models: [{ ...qwen, variants: { other: { model: "something-else" } } }],
    });
    // Unknown keys are dropped from a variant, so the model id cannot change
    expect(result.success).toBe(true);
    expect((result as any).data.models[0].variants.other).not.toHaveProperty(
      "model",
    );
  });
});

describe("unrolling a config that uses the catalog", () => {
  const id: PackageIdentifier = {
    uriType: "file",
    fileUri: "/tmp/config.yaml",
  };
  const registry: Registry = {
    getContent: async () => {
      throw new Error("no blocks in this test");
    },
  };
  const secrets: Record<string, string> = { ANTHROPIC_KEY: "sk-ant" };
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

  it("mixes a local account's variant and a cloud model in one config", async () => {
    const yaml = `name: Mixed
version: 1.0.0
schema: v1
models:
  - from: Qwen3.8 Flash#act
    roles: [chat, edit, apply]
modeModels:
  plan:
    model: Claude Sonnet
  agent:
    model: Qwen3.8 Flash#act
`;
    const result = await unrollAssistantFromContent(id, yaml, registry, {
      renderSecrets: true,
      currentUserSlug: "",
      platformClient,
      catalog: [qwen, sonnet],
      providers: [
        {
          name: "strata",
          provider: "openai",
          apiBase: "http://127.0.0.1:8080/v1/",
        },
      ],
    });
    expect(result.errors?.filter((e) => e.fatal)).toEqual([]);
    const byName = new Map(
      (result.config?.models ?? []).map((m) => [m?.name, m]),
    );
    expect(byName.get("Qwen3.8 Flash#act")).toMatchObject({
      provider: "openai",
      apiBase: "http://127.0.0.1:8080/v1/",
      roles: ["chat", "edit", "apply"],
    });
    expect(byName.get("Claude Sonnet")).toMatchObject({
      provider: "anthropic",
      apiKey: "sk-ant",
      roles: ["chat"],
    });
  });

  it("fills in secret references inside a catalog model's env", async () => {
    secrets.BEDROCK_SECRET_ACCESS_KEY = "rendered-secret";
    const yaml = `name: Env
version: 1.0.0
schema: v1
models:
  - from: Claude Keys
`;
    const result = await unrollAssistantFromContent(id, yaml, registry, {
      renderSecrets: true,
      currentUserSlug: "",
      platformClient,
      catalog: [
        {
          name: "Claude Keys",
          provider: "bedrock",
          model: "anthropic.claude-haiku-4-5-20251001-v1:0",
          env: {
            region: "us-east-1",
            secretAccessKey: "${{ secrets.BEDROCK_SECRET_ACCESS_KEY }}",
          },
        },
      ],
      providers: [],
    });
    expect(result.errors?.filter((e) => e.fatal)).toEqual([]);
    expect(result.config?.models?.[0]?.env).toMatchObject({
      region: "us-east-1",
      secretAccessKey: "rendered-secret",
    });
  });

  it("keeps every from: entry, the model and its variants side by side", async () => {
    // Found in the Windows Sandbox check: entries with no name of their own
    // collided in the duplicate check, and only the first one was kept.
    const yaml = `name: Variants
version: 1.0.0
schema: v1
models:
  - from: Qwen3.8 Flash
  - from: Qwen3.8 Flash#act
    roles: [subagent]
  - from: Claude Sonnet
    roles: [chat]
`;
    const result = await unrollAssistantFromContent(id, yaml, registry, {
      renderSecrets: true,
      currentUserSlug: "",
      platformClient,
      catalog: [qwen, sonnet],
      providers: [
        {
          name: "strata",
          provider: "openai",
          apiBase: "http://127.0.0.1:8080/v1/",
        },
      ],
    });
    expect(
      (result.config?.models ?? []).map((m) => [m?.name, m?.roles]),
    ).toEqual([
      ["Qwen3.8 Flash", undefined],
      ["Qwen3.8 Flash#act", ["subagent"]],
      ["Claude Sonnet", ["chat"]],
    ]);
  });
});
