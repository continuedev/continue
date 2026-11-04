import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ConfigYaml } from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as YAML from "yaml";

import { editYamlText } from "../util/yamlEdit";

import {
  candidateSettingsPaths,
  convertSettings,
  findSettingsFiles,
  importMcpServers,
  McpImportDeps,
  previewImport,
} from "./importClineMcp";

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, "fixtures", "clineMcp", name), "utf8");

const CLINE = fixture("cline_mcp_settings.json");
const ROO = fixture("roo_mcp_settings.json");

describe("settings file locations", () => {
  it("builds the per-OS globalStorage paths", () => {
    const linux = candidateSettingsPaths({ platform: "linux", home: "/h" });
    expect(linux[0].path).toBe(
      "/h/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
    );
    const mac = candidateSettingsPaths({
      platform: "darwin",
      home: "/Users/u",
    });
    expect(mac[0].path).toBe(
      "/Users/u/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
    );
    const win = candidateSettingsPaths({
      platform: "win32",
      home: "C:\\Users\\u",
      appData: "C:\\Users\\u\\AppData\\Roaming",
    });
    expect(win[0].path.replace(/\\/g, "/")).toContain(
      "Roaming/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
    );
  });

  it("includes Roo Code and only returns files that exist", () => {
    const env = { platform: "linux" as const, home: "/h" };
    const rooPath =
      "/h/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json";
    expect(candidateSettingsPaths(env).map((s) => s.path)).toContain(rooPath);
    const found = findSettingsFiles(env, (p) => p === rooPath);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("roo");
  });
});

describe("convertSettings (Cline fixture)", () => {
  const { servers, skipped } = convertSettings(CLINE, ["Existing-One"]);
  const byName = Object.fromEntries(servers.map((s) => [s.name, s]));

  it("converts stdio with env, secrets and timeout", () => {
    expect(byName.github.yaml).toEqual({
      name: "github",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN:
          "${{ secrets.GITHUB_PERSONAL_ACCESS_TOKEN }}",
        LOG_LEVEL: "debug",
      },
      connectionTimeout: 30000,
    });
    expect(byName.github.secrets).toEqual([
      {
        name: "GITHUB_PERSONAL_ACCESS_TOKEN",
        value: "ghp_fixturetoken123",
      },
    ]);
  });

  it("maps autoApprove to allow rules", () => {
    expect(byName.github.allowRules).toEqual([
      "mcp__github__list_issues",
      "mcp__github__get_issue",
    ]);
  });

  it("converts sse with header and query-string secrets", () => {
    expect(byName["remote-sse"].yaml).toEqual({
      name: "remote-sse",
      url: "https://mcp.example.com/sse?api_key=${{ secrets.REMOTE_SSE_API_KEY }}&region=eu",
      type: "sse",
      requestOptions: {
        headers: {
          Authorization: "Bearer ${{ secrets.REMOTE_SSE_AUTHORIZATION }}",
          "X-Team": "platform",
        },
      },
    });
    expect(byName["remote-sse"].secrets.map((s) => s.value)).toEqual([
      "abc123",
      "fixture-bearer-value",
    ]);
  });

  it("converts streamableHttp to streamable-http", () => {
    expect(byName["remote-http"].yaml.type).toBe("streamable-http");
    expect(byName["remote-http"].yaml.requestOptions).toEqual({
      headers: { "X-API-Key": "${{ secrets.REMOTE_HTTP_X_API_KEY }}" },
    });
  });

  it("never leaves a secret value in a converted entry", () => {
    const yaml = JSON.stringify(servers.map((s) => s.yaml));
    for (const v of [
      "ghp_fixturetoken123",
      "abc123",
      "fixture-bearer-value",
      "fixture-api-key",
    ]) {
      expect(yaml).not.toContain(v);
    }
  });

  it("skips duplicates (case-insensitive), disabled, invalid and unknown transports", () => {
    expect(skipped.map((s) => [s.name, s.reason])).toEqual([
      ["sleepy", "disabled"],
      ["existing-one", "duplicate"],
      ["broken", "unsupported-transport"],
      ["weird", "unsupported-transport"],
    ]);
  });

  it("reports unreadable files", () => {
    expect(convertSettings("{nope", []).error).toMatch(/JSON/);
    expect(convertSettings("{}", []).error).toMatch(/mcpServers/);
  });
});

describe("convertSettings (Roo fixture)", () => {
  it("handles alwaysAllow and keeps non-secret env inline", () => {
    const { servers } = convertSettings(ROO, []);
    expect(servers.map((s) => s.name)).toEqual(["filesystem", "docs"]);
    expect(servers[0].yaml.env).toEqual({ HOME_DIR: "/tmp" });
    expect(servers[0].allowRules).toEqual(["mcp__filesystem__read_file"]);
    expect(servers[1].yaml).toEqual({
      name: "docs",
      url: "https://docs.example.com/mcp",
      type: "streamable-http",
    });
  });
});

describe("previewImport", () => {
  it("lists names only, never values", () => {
    const preview = previewImport(
      [{ kind: "cline", label: "Cline", path: "/x/cline.json" }],
      ["existing-one"],
      () => CLINE,
    );
    const text = JSON.stringify(preview);
    expect(text).not.toContain("ghp_fixturetoken123");
    const github = preview.sources[0].servers.find((s) => s.name === "github");
    expect(github).toMatchObject({
      status: "new",
      transport: "stdio",
      secretNames: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
      allowedToolCount: 2,
    });
    expect(
      preview.sources[0].servers.find((s) => s.name === "existing-one")?.status,
    ).toBe("duplicate");
  });
});

describe("importMcpServers", () => {
  let dir: string;
  let configText: string | undefined;
  let secrets: Record<string, string>;

  const SRC = { kind: "cline" as const, label: "Cline", path: "/x/cline.json" };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cline-import-"));
    secrets = {};
    configText = `# my config
name: test
version: 1.0.0
schema: v1
mcpServers:
  # already set up
  - name: existing-one
    command: ls
`;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const deps = (over: Partial<McpImportDeps> = {}): McpImportDeps => ({
    ide: {
      readSecrets: async (keys: string[]) =>
        Object.fromEntries(
          keys.filter((k) => k in secrets).map((k) => [k, secrets[k]]),
        ),
      writeSecrets: async (s: Record<string, string>) => {
        Object.assign(secrets, s);
      },
    },
    continueDir: dir,
    sources: [SRC],
    readText: () => CLINE,
    readConfig: () =>
      configText === undefined
        ? undefined
        : (YAML.parse(configText) as ConfigYaml),
    editConfig: (cb) => {
      if (configText === undefined) return false;
      const { text, error } = editYamlText<ConfigYaml>(configText, cb);
      expect(error).toBeUndefined();
      if (text) configText = text;
      return true;
    },
    ...over,
  });

  const req = (over = {}) => ({
    sourcePath: SRC.path,
    names: ["github", "remote-sse", "remote-http", "existing-one"],
    storeSecrets: true,
    storage: "secure" as const,
    ...over,
  });

  it("writes servers with secret references, stores values, keeps comments", async () => {
    const result = await importMcpServers(req(), deps());
    expect(result.error).toBeUndefined();
    expect(result.imported).toEqual(["github", "remote-sse", "remote-http"]);
    expect(result.secretsStored).toEqual([
      "GITHUB_PERSONAL_ACCESS_TOKEN",
      "REMOTE_SSE_API_KEY",
      "REMOTE_SSE_AUTHORIZATION",
      "REMOTE_HTTP_X_API_KEY",
    ]);
    expect(secrets.GITHUB_PERSONAL_ACCESS_TOKEN).toBe("ghp_fixturetoken123");

    expect(configText).toContain("# my config");
    expect(configText).toContain("# already set up");
    expect(configText).not.toContain("ghp_fixturetoken123");
    expect(configText).not.toContain("fixture-bearer-value");

    const parsed = YAML.parse(configText!);
    expect(parsed.mcpServers.map((s: any) => s.name)).toEqual([
      "existing-one",
      "github",
      "remote-sse",
      "remote-http",
    ]);
    expect(parsed.mcpServers[1].env.GITHUB_PERSONAL_ACCESS_TOKEN).toBe(
      "${{ secrets.GITHUB_PERSONAL_ACCESS_TOKEN }}",
    );
    expect(parsed.toolPermissions.allow).toEqual([
      "mcp__github__list_issues",
      "mcp__github__get_issue",
    ]);
  });

  it("is idempotent: a second import adds nothing", async () => {
    await importMcpServers(req(), deps());
    const after = configText;
    const again = await importMcpServers(req(), deps());
    expect(again.error).toMatch(/No servers/);
    expect(configText).toBe(after);
  });

  it("writes references without values when asked not to store", async () => {
    const result = await importMcpServers(
      req({ storeSecrets: false, names: ["github"] }),
      deps(),
    );
    expect(result.secretsStored).toEqual([]);
    expect(result.secretsPending).toEqual(["GITHUB_PERSONAL_ACCESS_TOKEN"]);
    expect(secrets).toEqual({});
    expect(configText).toContain("secrets.GITHUB_PERSONAL_ACCESS_TOKEN");
    // an empty line to fill in
    expect(fs.readFileSync(path.join(dir, ".env"), "utf8")).toBe(
      "GITHUB_PERSONAL_ACCESS_TOKEN=\n",
    );
  });

  it("stores to ~/.continue/.env when asked", async () => {
    await importMcpServers(req({ storage: "env", names: ["github"] }), deps());
    expect(fs.readFileSync(path.join(dir, ".env"), "utf8")).toContain(
      "GITHUB_PERSONAL_ACCESS_TOKEN=ghp_fixturetoken123",
    );
  });

  it("does not overwrite a secret that already has a value", async () => {
    secrets.GITHUB_PERSONAL_ACCESS_TOKEN = "mine";
    const result = await importMcpServers(req({ names: ["github"] }), deps());
    expect(secrets.GITHUB_PERSONAL_ACCESS_TOKEN).toBe("mine");
    expect(result.warnings[0]).toMatch(/already has a value/);
    expect(result.imported).toEqual(["github"]);
  });

  it("reports a secret that could not be stored but still imports", async () => {
    const result = await importMcpServers(
      req({ names: ["github"] }),
      deps({
        ide: {
          readSecrets: async () => ({}),
          writeSecrets: async () => {
            throw new Error("locked");
          },
        },
      }),
    );
    expect(result.secretsPending).toEqual(["GITHUB_PERSONAL_ACCESS_TOKEN"]);
    expect(result.imported).toEqual(["github"]);
    expect(JSON.stringify(result)).not.toContain("ghp_fixturetoken123");
  });

  it("only imports the selected servers", async () => {
    const result = await importMcpServers(
      req({ names: ["remote-http"] }),
      deps(),
    );
    expect(result.imported).toEqual(["remote-http"]);
    expect(YAML.parse(configText!).mcpServers).toHaveLength(2);
  });

  it("refuses unknown source paths and missing config", async () => {
    expect(
      (await importMcpServers(req({ sourcePath: "/etc/passwd" }), deps()))
        .error,
    ).toMatch(/not a settings file/);
    configText = undefined;
    const result = await importMcpServers(req(), deps());
    expect(result.error).toMatch(/no config.yaml/);
    expect(secrets).toEqual({});
  });
});
