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
  it("builds CONTINUED_<PROVIDER>_API_KEY", () => {
    expect(defaultSecretName("anthropic")).toBe("CONTINUED_ANTHROPIC_API_KEY");
    expect(defaultSecretName("bedrock-mantle")).toBe(
      "CONTINUED_BEDROCK_MANTLE_API_KEY",
    );
    expect(defaultSecretName("")).toBe("CONTINUED_PROVIDER_API_KEY");
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
        secretName: "CONTINUED_ANTHROPIC_API_KEY",
        value: "sk-ant-secret",
      },
    });
    expect(next.models).toHaveLength(2);
    for (const m of next.models as any[]) {
      expect(m.apiKey).toBe("${{ secrets.CONTINUED_ANTHROPIC_API_KEY }}");
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
        secretName: "CONTINUED_ANTHROPIC_API_KEY",
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
      "${{ secrets.CONTINUED_ANTHROPIC_API_KEY }}",
      "${{ secrets.CONTINUED_ANTHROPIC_API_KEY }}",
    ]);
  });
});
