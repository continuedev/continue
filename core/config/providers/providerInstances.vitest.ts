import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import * as YAML from "yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readSecretFromEnvFile } from "../../util/secretsFile";
import {
  deleteProviderInstance,
  describeKey,
  findPlaintextKeys,
  listProviderInstances,
  movePlaintextKeys,
  saveProviderInstance,
} from "./providerInstances";
import { getGlobalProvidersPath } from "./providersFile";
import { looksLikePlaceholderKey } from "./types";

function fakeIde(files: Record<string, string> = {}) {
  const secrets: Record<string, string> = {};
  return {
    files,
    secrets,
    readSecrets: async (keys: string[]) =>
      Object.fromEntries(
        keys.filter((k) => k in secrets).map((k) => [k, secrets[k]]),
      ),
    writeSecrets: async (s: Record<string, string>) => {
      Object.assign(secrets, s);
    },
    readFile: async (uri: string) => {
      if (!(uri in files)) throw new Error(`no ${uri}`);
      return files[uri];
    },
    writeFile: async (uri: string, text: string) => {
      files[uri] = text;
    },
  };
}

const providersPath = () => getGlobalProvidersPath();
const readProviders = () =>
  YAML.parse(fs.readFileSync(providersPath(), "utf8"));

describe("provider instances", () => {
  let continueDir: string;
  let before: string | undefined;

  beforeEach(() => {
    continueDir = fs.mkdtempSync(path.join(os.tmpdir(), "instances-"));
    before = fs.existsSync(providersPath())
      ? fs.readFileSync(providersPath(), "utf8")
      : undefined;
    fs.rmSync(providersPath(), { force: true });
  });

  afterEach(() => {
    if (before === undefined) fs.rmSync(providersPath(), { force: true });
    else fs.writeFileSync(providersPath(), before);
    fs.rmSync(continueDir, { recursive: true, force: true });
  });

  it("describes keys without their values", () => {
    expect(describeKey(undefined)).toEqual({ state: "none" });
    expect(describeKey("${{ secrets.A_KEY }}")).toEqual({
      state: "secret",
      secretName: "A_KEY",
    });
    expect(describeKey("sk-live")).toEqual({ state: "inline" });
  });

  it("adds an instance whose key goes to secure storage, not the file", async () => {
    const ide = fakeIde();
    const result = await saveProviderInstance(
      ide,
      {
        name: "anthropic-work",
        provider: "anthropic",
        apiBase: "https://proxy.example.com/v1/",
        key: { storage: "secure", value: "sk-ant-secret" },
      },
      { continueDir, configFiles: [] },
    );
    expect(result).toEqual({ saved: true });
    expect(ide.secrets.CONTINUOUS_ANTHROPIC_WORK_API_KEY).toBe("sk-ant-secret");
    const text = fs.readFileSync(providersPath(), "utf8");
    expect(text).not.toContain("sk-ant-secret");
    expect(readProviders().providers).toEqual([
      {
        name: "anthropic-work",
        provider: "anthropic",
        apiBase: "https://proxy.example.com/v1/",
        apiKey: "${{ secrets.CONTINUOUS_ANTHROPIC_WORK_API_KEY }}",
      },
    ]);
  });

  it("lists instances with key presence and the models that use them", async () => {
    const ide = fakeIde();
    await saveProviderInstance(
      ide,
      {
        name: "work",
        provider: "openai",
        key: { storage: "secure", value: "k" },
      },
      { continueDir, configFiles: [] },
    );
    const info = await listProviderInstances(ide, {
      workspaceFiles: [
        {
          uri: "file:///ws/.continuous/providers.yaml",
          label: "providers.yaml (workspace)",
          content: "providers:\n  - { name: work, provider: openai }\n",
        },
      ],
      configFiles: [
        {
          uri: "file:///c.yaml",
          label: "Cloud",
          content:
            "models:\n  - { name: GPT, connection: work, model: gpt-6 }\n",
        },
      ],
      continueDir,
      secureStorageAvailable: true,
    });
    const global = info.instances.find((i) => i.source === "global")!;
    expect(global.key).toEqual({
      state: "secret",
      secretName: "CONTINUOUS_WORK_API_KEY",
      storedIn: { secure: true, env: false },
    });
    expect(global.usedBy).toEqual([{ config: "Cloud", model: "GPT" }]);
    expect(global.overridden).toBe(true);
    expect(JSON.stringify(info)).not.toContain('"k"');
  });

  it("renames an instance and the connections that use it", async () => {
    const ide = fakeIde({
      "file:///c.yaml":
        "# cloud\nmodels:\n  - name: GPT\n    connection: work\n    model: gpt-6\n",
    });
    await saveProviderInstance(
      ide,
      { name: "work", provider: "openai" },
      { continueDir, configFiles: [] },
    );
    const result = await saveProviderInstance(
      ide,
      { previousName: "work", name: "openai-work", provider: "openai" },
      {
        continueDir,
        configFiles: [
          {
            uri: "file:///c.yaml",
            label: "Cloud",
            content: ide.files["file:///c.yaml"],
          },
        ],
      },
    );
    expect(result).toEqual({ saved: true, modelsUpdated: 1 });
    expect(readProviders().providers.map((p: any) => p.name)).toEqual([
      "openai-work",
    ]);
    expect(ide.files["file:///c.yaml"]).toContain("connection: openai-work");
    expect(ide.files["file:///c.yaml"]).toContain("# cloud");
  });

  it("refuses a duplicate name, a bad name and a bad base URL", async () => {
    const ide = fakeIde();
    const opts = { continueDir, configFiles: [] };
    await saveProviderInstance(ide, { name: "a", provider: "openai" }, opts);
    expect(
      await saveProviderInstance(ide, { name: "a", provider: "groq" }, opts),
    ).toMatchObject({ saved: false, error: expect.stringMatching(/exists/) });
    expect(
      await saveProviderInstance(ide, { name: "a b", provider: "x" }, opts),
    ).toMatchObject({ saved: false });
    expect(
      await saveProviderInstance(
        ide,
        { name: "b", provider: "x", apiBase: "ftp://x" },
        opts,
      ),
    ).toMatchObject({ saved: false, error: expect.stringMatching(/http/) });
  });

  it("deletes an instance", async () => {
    const ide = fakeIde();
    await saveProviderInstance(
      ide,
      { name: "a", provider: "openai" },
      { continueDir, configFiles: [] },
    );
    expect(deleteProviderInstance("a")).toEqual({ deleted: true });
    expect(readProviders().providers).toEqual([]);
    expect(deleteProviderInstance("a").deleted).toBe(false);
  });
});

describe("plaintext keys", () => {
  let continueDir: string;
  beforeEach(() => {
    continueDir = fs.mkdtempSync(path.join(os.tmpdir(), "plaintext-"));
  });
  afterEach(() => fs.rmSync(continueDir, { recursive: true, force: true }));

  const config = `name: Cloud
# my models
models:
  - name: GPT
    provider: openai
    model: gpt-6
    apiKey: sk-proj-real
  - name: Other GPT
    provider: openai
    model: gpt-6-mini
    apiKey: sk-proj-other
  - name: Example
    provider: anthropic
    model: x
    apiKey: YOUR_ANTHROPIC_API_KEY_HERE
  - name: Ref
    provider: anthropic
    model: y
    apiKey: \${{ secrets.ANTHROPIC_API_KEY }}
`;

  it("skips placeholders and references", () => {
    expect(looksLikePlaceholderKey("YOUR_OPENAI_API_KEY_HERE")).toBe(true);
    expect(looksLikePlaceholderKey("<key>")).toBe(true);
    expect(looksLikePlaceholderKey("ollama")).toBe(true);
    expect(looksLikePlaceholderKey("sk-proj-abc123")).toBe(false);
    const keys = findPlaintextKeys([
      { uri: "file:///c.yaml", label: "Cloud", content: config },
    ]);
    expect(keys.map((k) => [k.label, k.secretName])).toEqual([
      ["GPT", "CONTINUOUS_OPENAI_API_KEY"],
      ["Other GPT", "CONTINUOUS_OPENAI_API_KEY"],
    ]);
    expect(JSON.stringify(keys)).not.toContain("sk-proj");
  });

  it("moves keys to secure storage under distinct names and rewrites the file", async () => {
    const ide = fakeIde({ "file:///c.yaml": config });
    const keys = findPlaintextKeys([
      { uri: "file:///c.yaml", label: "Cloud", content: config },
    ]);
    const result = await movePlaintextKeys(
      ide,
      keys.map((k) => k.id),
      { storage: "secure", continueDir },
    );
    expect(result.failed).toEqual([]);
    expect(result.moved).toHaveLength(2);
    expect(ide.secrets).toEqual({
      CONTINUOUS_OPENAI_API_KEY: "sk-proj-real",
      CONTINUOUS_OPENAI_API_KEY_2: "sk-proj-other",
    });
    const text = ide.files["file:///c.yaml"];
    expect(text).not.toContain("sk-proj");
    expect(text).toContain("# my models");
    const models = YAML.parse(text).models;
    expect(models[0].apiKey).toBe("${{ secrets.CONTINUOUS_OPENAI_API_KEY }}");
    expect(models[1].apiKey).toBe("${{ secrets.CONTINUOUS_OPENAI_API_KEY_2 }}");
    expect(models[2].apiKey).toBe("YOUR_ANTHROPIC_API_KEY_HERE");
  });

  it("reuses a secret that already holds the same value", async () => {
    const ide = fakeIde({ "file:///c.yaml": config });
    ide.secrets.CONTINUOUS_OPENAI_API_KEY = "sk-proj-other";
    const keys = findPlaintextKeys([
      { uri: "file:///c.yaml", label: "Cloud", content: config },
    ]);
    await movePlaintextKeys(ide, [keys[1].id], {
      storage: "secure",
      continueDir,
    });
    expect(YAML.parse(ide.files["file:///c.yaml"]).models[1].apiKey).toBe(
      "${{ secrets.CONTINUOUS_OPENAI_API_KEY }}",
    );
  });

  it("can use ~/.continuous/.env", async () => {
    const ide = fakeIde({ "file:///c.yaml": config });
    const [first] = findPlaintextKeys([
      { uri: "file:///c.yaml", label: "Cloud", content: config },
    ]);
    const result = await movePlaintextKeys(ide, [first.id], {
      storage: "env",
      continueDir,
    });
    expect(result.moved).toEqual([first.id]);
    expect(
      readSecretFromEnvFile(continueDir, "CONTINUOUS_OPENAI_API_KEY"),
    ).toBe("sk-proj-real");
  });

  it("does nothing to a key that changed after it was found", async () => {
    const ide = fakeIde({ "file:///c.yaml": config });
    const [first] = findPlaintextKeys([
      { uri: "file:///c.yaml", label: "Cloud", content: config },
    ]);
    ide.files["file:///c.yaml"] = "models: []\n";
    const result = await movePlaintextKeys(ide, [first.id], {
      storage: "secure",
      continueDir,
    });
    expect(result.moved).toEqual([]);
    expect(result.failed[0].error).toMatch(/changed/);
    expect(ide.secrets).toEqual({});
  });
});
