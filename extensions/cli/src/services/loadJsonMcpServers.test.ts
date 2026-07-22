import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadJsonMcpServers } from "./loadJsonMcpServers.js";

describe("loadJsonMcpServers", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cn-mcp-json-"));
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  function writeWorkspaceMcpFile(fileName: string, content: unknown): void {
    const dir = path.join(cwd, ".continue", "mcpServers");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), JSON.stringify(content));
  }

  it("returns an empty array when there is no mcpServers directory", () => {
    expect(loadJsonMcpServers(cwd)).toEqual([]);
  });

  it("discovers a single-server stdio file, named after the file", () => {
    writeWorkspaceMcpFile("playwright.json", {
      command: "npx",
      args: ["-y", "@playwright/mcp"],
    });

    const servers = loadJsonMcpServers(cwd);

    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({
      name: "playwright",
      type: "stdio",
      command: "npx",
      args: ["-y", "@playwright/mcp"],
    });
  });

  it("discovers servers from a Claude-desktop-style mcpServers map", () => {
    writeWorkspaceMcpFile("config.json", {
      mcpServers: { weather: { command: "uvx", args: ["weather-mcp"] } },
    });

    const servers = loadJsonMcpServers(cwd);

    expect(servers.map((s) => s.name)).toEqual(["weather"]);
  });

  it("discovers an http server and maps the transport type", () => {
    writeWorkspaceMcpFile("remote.json", {
      url: "https://example.com/mcp",
      type: "http",
    });

    const servers = loadJsonMcpServers(cwd);

    expect(servers[0]).toMatchObject({
      name: "remote",
      url: "https://example.com/mcp",
      type: "streamable-http",
    });
  });

  it("skips files that do not match a supported MCP config format", () => {
    writeWorkspaceMcpFile("notes.json", { hello: "world" });

    expect(loadJsonMcpServers(cwd)).toEqual([]);
  });

  it("de-duplicates servers by name, keeping the first encountered", () => {
    writeWorkspaceMcpFile("a.json", {
      mcpServers: { dup: { command: "first" } },
    });
    writeWorkspaceMcpFile("b.json", {
      mcpServers: { dup: { command: "second" } },
    });

    const servers = loadJsonMcpServers(cwd);

    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({ name: "dup", command: "first" });
  });
});
