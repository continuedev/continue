import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ConfigYaml } from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as YAML from "yaml";

import type { JSONModelDescription } from "..";
import {
  applyProviderModels,
  defaultSecretName,
  describeProviderConnections,
  removeFromModeModels,
  validateSaveRequest,
} from "./providerSetup";

const desc = (
  provider: string,
  model: string,
  extra: Partial<JSONModelDescription> = {},
): JSONModelDescription =>
  ({ title: model, provider, model, ...extra }) as JSONModelDescription;

const base = (models: any[], extra: Record<string, any> = {}): ConfigYaml =>
  ({ name: "c", version: "1", schema: "v1", models, ...extra }) as any;

describe("defaultSecretName", () => {
  it("builds CONTINUOUS_<PROVIDER>_API_KEY", () => {
    expect(defaultSecretName("anthropic")).toBe("CONTINUOUS_ANTHROPIC_API_KEY");
    expect(defaultSecretName("bedrock-mantle")).toBe(
      "CONTINUOUS_BEDROCK_MANTLE_API_KEY",
    );
    expect(defaultSecretName("")).toBe("CONTINUOUS_PROVIDER_API_KEY");
  });
});

describe("describeProviderConnections", () => {
  it("groups by provider and endpoint and never returns a key", () => {
    const groups = describeProviderConnections(
      base([
        {
          name: "A",
          provider: "openai",
          model: "a",
          apiKey: "${{ secrets.OPENAI_KEY }}",
        },
        { name: "B", provider: "openai", model: "b", apiKey: "sk-literal" },
        {
          name: "C",
          provider: "openai",
          model: "c",
          apiBase: "http://localhost:1234/v1/",
          apiKey: "sk-other",
        },
        { name: "D", provider: "ollama", model: "d" },
        { uses: "owner/pkg" },
      ]),
    );
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({
      provider: "openai",
      connection: {},
      models: [
        { name: "A", model: "a" },
        { name: "B", model: "b" },
      ],
      key: { state: "secret", secretName: "OPENAI_KEY" },
    });
    expect(groups[1].connection).toEqual({
      apiBase: "http://localhost:1234/v1",
    });
    expect(groups[1].key).toEqual({ state: "inline" });
    expect(groups[2].key).toEqual({ state: "none" });
    expect(JSON.stringify(groups)).not.toContain("sk-literal");
    expect(JSON.stringify(groups)).not.toContain("sk-other");
  });

  it("tells Bedrock regions apart", () => {
    const groups = describeProviderConnections(
      base([
        {
          name: "A",
          provider: "bedrock",
          model: "a",
          env: { region: "us-east-1" },
        },
        {
          name: "B",
          provider: "bedrock",
          model: "b",
          env: { region: "eu-west-1" },
        },
      ]),
    );
    expect(groups.map((g) => g.connection.region)).toEqual([
      "us-east-1",
      "eu-west-1",
    ]);
  });
});

describe("applyProviderModels", () => {
  it("adds models that all share one secret reference", () => {
    const next = applyProviderModels(base([]), {
      provider: "anthropic",
      add: [desc("anthropic", "opus"), desc("anthropic", "sonnet")],
      key: {
        storage: "secure",
        secretName: "CONTINUOUS_ANTHROPIC_API_KEY",
        value: "sk-ant-secret",
      },
    });
    expect(next.models).toHaveLength(2);
    for (const m of next.models as any[]) {
      expect(m.apiKey).toBe("${{ secrets.CONTINUOUS_ANTHROPIC_API_KEY }}");
    }
    expect(JSON.stringify(next)).not.toContain("sk-ant-secret");
  });

  it("writes the value only for inline storage", () => {
    const next = applyProviderModels(base([]), {
      provider: "openai",
      add: [desc("openai", "gpt")],
      key: { storage: "inline", value: "sk-inline" },
    });
    expect((next.models as any[])[0].apiKey).toBe("sk-inline");
  });

  it("references an environment variable without storing anything", () => {
    const next = applyProviderModels(base([]), {
      provider: "openai",
      add: [desc("openai", "gpt")],
      key: { storage: "envVar", secretName: "MY_OPENAI_KEY" },
    });
    expect((next.models as any[])[0].apiKey).toBe(
      "${{ secrets.MY_OPENAI_KEY }}",
    );
  });

  it("gives models added later the key reference the connection already has", () => {
    const next = applyProviderModels(
      base([
        {
          name: "Old",
          provider: "openai",
          model: "old",
          apiKey: "${{ secrets.OPENAI_KEY }}",
        },
      ]),
      { provider: "openai", add: [desc("openai", "new")] },
    );
    expect((next.models as any[])[1].apiKey).toBe("${{ secrets.OPENAI_KEY }}");
    expect((next.models as any[])[0].apiKey).toBe("${{ secrets.OPENAI_KEY }}");
  });

  it("merges into an existing entry and keeps fields added by hand", () => {
    const existing = {
      name: "My Opus",
      provider: "anthropic",
      model: "opus",
      roles: ["chat"],
      requestOptions: { timeout: 5 },
    };
    const next = applyProviderModels(base([existing]), {
      provider: "anthropic",
      add: [desc("anthropic", "opus")],
      key: { storage: "env", secretName: "K", value: "v" },
    });
    expect(next.models).toEqual([{ ...existing, apiKey: "${{ secrets.K }}" }]);
  });

  it("keeps entries of other connections untouched", () => {
    const other = {
      name: "Local",
      provider: "openai",
      model: "x",
      apiBase: "http://localhost:1/v1",
      apiKey: "local-key",
    };
    const next = applyProviderModels(base([other]), {
      provider: "openai",
      add: [desc("openai", "gpt")],
      key: { storage: "env", secretName: "OPENAI_KEY", value: "v" },
    });
    expect((next.models as any[])[0]).toEqual(other);
    expect((next.models as any[])[1].apiKey).toBe("${{ secrets.OPENAI_KEY }}");
  });

  it("treats the same model id on another endpoint as a new model", () => {
    const next = applyProviderModels(
      base([
        {
          name: "gpt",
          provider: "openai",
          model: "gpt",
          apiBase: "http://a/v1",
        },
      ]),
      { provider: "openai", add: [desc("openai", "gpt")] },
    );
    expect(next.models).toHaveLength(2);
    expect((next.models as any[])[1].name).toBe("gpt (1)");
  });

  it("removes models of the connection only, and drops them from modeModels", () => {
    const next = applyProviderModels(
      base(
        [
          { name: "A", provider: "openai", model: "a" },
          { name: "B", provider: "openai", model: "b" },
          { name: "A", provider: "ollama", model: "a" },
        ],
        {
          modeModels: {
            plan: { model: "A", models: ["A", "B"], reasoningEffort: "high" },
            agent: { model: "A" },
            chat: { model: "Z" },
          },
        },
      ),
      { provider: "openai", remove: ["A"] },
    );
    expect(
      (next.models as any[]).map((m) => `${m.provider}:${m.name}`),
    ).toEqual(["openai:B", "ollama:A"]);
    expect((next as any).modeModels).toEqual({
      plan: { model: "B", models: ["B"], reasoningEffort: "high" },
      chat: { model: "Z" },
    });
  });
});

describe("removeFromModeModels", () => {
  it("removes modeModels entirely when nothing is left", () => {
    const next = removeFromModeModels(
      base([], { modeModels: { plan: { model: "A" } } }),
      ["A"],
    );
    expect("modeModels" in next).toBe(false);
  });

  it("is a no-op without modeModels or names", () => {
    const config = base([]);
    expect(removeFromModeModels(config, ["A"])).toBe(config);
  });
});

describe("validateSaveRequest", () => {
  const ok = { provider: "openai" };
  it("accepts a request without a key", () => {
    expect(validateSaveRequest(ok)).toBeUndefined();
  });

  it("requires a valid environment variable name for non-inline storage", () => {
    for (const secretName of [
      "",
      "1X",
      "a b",
      "A=B",
      "A\nB",
      "a-b",
      undefined,
    ]) {
      expect(
        validateSaveRequest({
          ...ok,
          key: { storage: "env", secretName, value: "v" },
        }),
      ).toMatch(/environment variable name/);
    }
    expect(
      validateSaveRequest({
        ...ok,
        key: { storage: "secure", secretName: "GOOD_NAME_1", value: "v" },
      }),
    ).toBeUndefined();
  });

  it("requires a value for inline, and not for envVar", () => {
    expect(validateSaveRequest({ ...ok, key: { storage: "inline" } })).toMatch(
      /Enter the key/,
    );
    expect(
      validateSaveRequest({
        ...ok,
        key: { storage: "envVar", secretName: "X" },
      }),
    ).toBeUndefined();
  });

  it("rejects models of another provider", () => {
    expect(
      validateSaveRequest({ ...ok, add: [desc("anthropic", "opus")] }),
    ).toMatch(/different provider/);
  });
});

describe("saveProviderModels on a real config.yaml", () => {
  let dir: string;
  let saveProviderModels: typeof import("./providerSetup").saveProviderModels;

  const SOURCE = `# my config
name: Local
version: 1.0.0
schema: v1

models:
  # primary
  - name: Opus
    provider: anthropic
    model: claude-opus
    apiKey: \${{ secrets.ANTHROPIC_API_KEY }}

rules:
  - be brief # keep
`;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "provider-setup-"));
    process.env.CONTINUE_GLOBAL_DIR = dir;
    fs.writeFileSync(path.join(dir, "config.yaml"), SOURCE);
    vi.resetModules();
    ({ saveProviderModels } = await import("./providerSetup"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.CONTINUE_GLOBAL_DIR;
  });

  it("keeps comments and never writes the key value", () => {
    const saved = saveProviderModels({
      provider: "anthropic",
      add: [desc("anthropic", "claude-sonnet", { title: "Sonnet" })],
      key: {
        storage: "env",
        secretName: "CONTINUOUS_ANTHROPIC_API_KEY",
        value: "sk-ant-should-not-appear",
      },
    });
    expect(saved).toBe(true);
    const text = fs.readFileSync(path.join(dir, "config.yaml"), "utf8");
    expect(text).toContain("# my config");
    expect(text).toContain("# primary");
    expect(text).toContain("be brief # keep");
    expect(text).not.toContain("sk-ant-should-not-appear");
    const models = YAML.parse(text).models;
    expect(models.map((m: any) => m.name)).toEqual(["Opus", "Sonnet"]);
    expect(models.map((m: any) => m.apiKey)).toEqual([
      "${{ secrets.CONTINUOUS_ANTHROPIC_API_KEY }}",
      "${{ secrets.CONTINUOUS_ANTHROPIC_API_KEY }}",
    ]);
  });
});

describe("editing a connection in place", () => {
  const LM = "http://localhost:1234/v1";
  const config = () =>
    base([
      { name: "GPT", provider: "openai", model: "gpt-5", apiKey: "k" },
      {
        name: "Qwen",
        provider: "openai",
        model: "qwen3",
        apiBase: `${LM}/`,
        apiKey: "k2",
        roles: ["chat"],
      },
      { name: "Llama", provider: "openai", model: "llama4", apiBase: LM },
    ]);

  it("changes apiBase on every entry of the connection and keeps their other fields", () => {
    const next = applyProviderModels(config(), {
      provider: "openai",
      from: { apiBase: LM },
      connection: { apiBase: "http://localhost:5678/v1" },
    });
    expect(next.models!.map((m: any) => [m.name, m.apiBase])).toEqual([
      ["GPT", undefined],
      ["Qwen", "http://localhost:5678/v1"],
      ["Llama", "http://localhost:5678/v1"],
    ]);
    expect((next.models![1] as any).roles).toEqual(["chat"]);
    expect(describeProviderConnections(next)).toHaveLength(2);
  });

  it("can clear the apiBase (back to the provider default)", () => {
    const onlyLocal = base([
      { name: "Qwen", provider: "openai", model: "qwen3", apiBase: LM },
      { name: "Llama", provider: "openai", model: "llama4", apiBase: LM },
    ]);
    const next = applyProviderModels(onlyLocal, {
      provider: "openai",
      from: { apiBase: LM },
      connection: {},
    });
    expect(next.models!.every((m: any) => !("apiBase" in m))).toBe(true);
  });

  it("moves a Bedrock region and profile without touching other env fields", () => {
    const bedrock = base([
      {
        name: "S",
        provider: "bedrock",
        model: "m",
        env: { region: "us-east-1", profile: "work", accessKeyId: "x" },
      },
    ]);
    const next = applyProviderModels(bedrock, {
      provider: "bedrock",
      from: { region: "us-east-1", profile: "work" },
      connection: { region: "eu-west-1" },
    });
    expect((next.models![0] as any).env).toEqual({
      region: "eu-west-1",
      accessKeyId: "x",
    });
  });

  it("applies adds, removes and the key to the moved connection", () => {
    const next = applyProviderModels(config(), {
      provider: "openai",
      from: { apiBase: LM },
      connection: { apiBase: "http://localhost:5678/v1" },
      remove: ["Llama"],
      add: [
        desc("openai", "gemma", {
          title: "Gemma",
          apiBase: "http://localhost:5678/v1",
        }),
      ],
      key: { storage: "env", secretName: "LM_KEY" },
    });
    expect(next.models!.map((m: any) => m.name)).toEqual([
      "GPT",
      "Qwen",
      "Gemma",
    ]);
    const moved = next.models!.slice(1) as any[];
    expect(moved.every((m) => m.apiBase === "http://localhost:5678/v1")).toBe(
      true,
    );
    expect(moved.every((m) => m.apiKey === "${{ secrets.LM_KEY }}")).toBe(true);
    // GPT is on another connection and keeps its key.
    expect((next.models![0] as any).apiKey).toBe("k");
  });

  it("refuses to merge into a connection that already has entries", () => {
    // GPT is on the default endpoint, so clearing the local apiBase would
    // silently fold two connections together.
    expect(() =>
      applyProviderModels(config(), {
        provider: "openai",
        from: { apiBase: LM },
        connection: {},
      }),
    ).toThrow(/already exists/);
  });

  it("does nothing special when from equals connection", () => {
    const before = config();
    const next = applyProviderModels(before, {
      provider: "openai",
      from: { apiBase: LM },
      connection: { apiBase: `${LM}/` },
    });
    expect(next.models).toEqual(before.models);
  });

  it("validateSaveRequest needs a target connection with from", () => {
    expect(
      validateSaveRequest({ provider: "openai", from: { apiBase: LM } }),
    ).toMatch(/endpoint/);
  });
});

describe("editing a connection in a real config.yaml", () => {
  let dir: string;
  let saveProviderModels: typeof import("./providerSetup").saveProviderModels;
  let ProviderSetupError: typeof import("./providerSetup").ProviderSetupError;
  const fixture = fs.readFileSync(
    path.join(__dirname, "testdata", "provider-setup-connections.config.yaml"),
    "utf8",
  );

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "provider-edit-"));
    process.env.CONTINUE_GLOBAL_DIR = dir;
    fs.writeFileSync(path.join(dir, "config.yaml"), fixture);
    vi.resetModules();
    ({ saveProviderModels, ProviderSetupError } =
      await import("./providerSetup"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.CONTINUE_GLOBAL_DIR;
  });

  const read = () => fs.readFileSync(path.join(dir, "config.yaml"), "utf8");

  it("moves the local endpoint in place and keeps comments, order and fields", () => {
    expect(
      saveProviderModels({
        provider: "openai",
        from: { apiBase: "http://localhost:1234/v1" },
        connection: { apiBase: "http://localhost:9999/v1" },
      }),
    ).toBe(true);

    const text = read();
    for (const comment of [
      "# Personal config. Keep these comments.",
      "# Hosted OpenAI",
      "# Local LM Studio (the endpoint is the thing being edited)",
      "# my favourite",
      "# low on purpose",
      "# Bedrock, work account",
      "# SSO",
      "- be brief # keep",
    ]) {
      expect(text).toContain(comment);
    }

    const parsed = YAML.parse(text);
    expect(parsed.models.map((m: any) => m.name)).toEqual([
      "GPT",
      "Local Qwen",
      "Local Llama",
      "Sonnet (Bedrock)",
    ]);
    expect(parsed.models.map((m: any) => m.apiBase)).toEqual([
      undefined,
      "http://localhost:9999/v1",
      "http://localhost:9999/v1",
      undefined,
    ]);
    // Nothing else about the entries changed, and no models were added.
    expect(parsed.models[1].roles).toEqual(["chat"]);
    expect(parsed.models[1].defaultCompletionOptions).toEqual({
      temperature: 0.2,
    });
    expect(parsed.models[1].apiKey).toBe("${{ secrets.LMSTUDIO_KEY }}");
    expect(parsed.modeModels.chat.models).toEqual(["Local Qwen", "GPT"]);
    expect(parsed.models[3].env).toEqual({
      region: "us-east-1",
      profile: "work",
      accessKeyId: "${{ secrets.AWS_KEY }}",
    });
    // Only the two apiBase lines differ.
    const changed = read()
      .split("\n")
      .filter((l, i) => l !== fixture.split("\n")[i]);
    expect(changed).toEqual([
      "    apiBase: http://localhost:9999/v1",
      "    apiBase: http://localhost:9999/v1",
    ]);
  });

  it("changes a Bedrock region in place", () => {
    saveProviderModels({
      provider: "bedrock",
      from: { region: "us-east-1", profile: "work" },
      connection: { region: "eu-west-1", profile: "work" },
    });
    const text = read();
    expect(text).toContain("profile: work # SSO");
    const bedrock = YAML.parse(text).models[3];
    expect(bedrock.env.region).toBe("eu-west-1");
    expect(bedrock.env.profile).toBe("work");
  });

  it("leaves the file untouched when the target endpoint is taken", () => {
    // GPT is the default OpenAI endpoint.
    expect(() =>
      saveProviderModels({
        provider: "openai",
        from: { apiBase: "http://localhost:1234/v1" },
        connection: {},
      }),
    ).toThrow(ProviderSetupError);
    expect(read()).toBe(fixture);
  });
});
