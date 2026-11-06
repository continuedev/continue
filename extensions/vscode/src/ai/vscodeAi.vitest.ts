import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => {
  class LanguageModelTextPart {
    constructor(public value: string) {}
  }
  class LanguageModelToolCallPart {
    constructor(
      public callId: string,
      public name: string,
      public input: object,
    ) {}
  }
  class LanguageModelToolResultPart {
    constructor(
      public callId: string,
      public content: unknown[],
    ) {}
  }
  class McpStdioServerDefinition {
    cwd?: unknown;
    constructor(
      public label: string,
      public command: string,
      public args: string[] = [],
      public env: Record<string, unknown> = {},
      public version?: string,
    ) {}
  }
  class McpHttpServerDefinition {
    constructor(
      public label: string,
      public uri: unknown,
      public headers: Record<string, string> = {},
      public version?: string,
    ) {}
  }
  class EventEmitter {
    listeners: (() => void)[] = [];
    event = (l: () => void) => {
      this.listeners.push(l);
      return { dispose() {} };
    };
    fire() {
      this.listeners.forEach((l) => l());
    }
    dispose() {}
  }
  return {
    LanguageModelTextPart,
    LanguageModelToolCallPart,
    LanguageModelToolResultPart,
    McpStdioServerDefinition,
    McpHttpServerDefinition,
    EventEmitter,
    LanguageModelChatMessageRole: { User: 1, Assistant: 2 },
    LanguageModelChatToolMode: { Auto: 1, Required: 2 },
    Uri: {
      file: (p: string) => ({ scheme: "file", path: p }),
      parse: (u: string) => ({ toString: () => u }),
    },
  };
});

import * as vscode from "vscode";

import {
  ContinuedLanguageModelChatProvider,
  modelInfo,
  toChatMessages,
  ToolCallCollector,
} from "./languageModelChatProvider";
import {
  ContinuedMcpServerDefinitionProvider,
  toDefinition,
} from "./mcpServerDefinitionProvider";

const msg = (role: number, content: unknown[]) =>
  ({ role, content, name: undefined }) as any;

describe("toChatMessages", () => {
  it("keeps text, assistant tool calls and tool results in order", () => {
    const out = toChatMessages([
      msg(1, [new vscode.LanguageModelTextPart("What changed?")]),
      msg(2, [
        new vscode.LanguageModelTextPart("Checking."),
        new vscode.LanguageModelToolCallPart("c1", "view_diff", {
          staged: true,
        }),
      ]),
      msg(1, [
        new vscode.LanguageModelToolResultPart("c1", [
          new vscode.LanguageModelTextPart("diff --git a b"),
        ]),
      ]),
    ]);
    expect(out).toEqual([
      { role: "user", content: "What changed?" },
      {
        role: "assistant",
        content: "Checking.",
        toolCalls: [
          {
            id: "c1",
            type: "function",
            function: { name: "view_diff", arguments: '{"staged":true}' },
          },
        ],
      },
      { role: "tool", toolCallId: "c1", content: "diff --git a b" },
    ]);
  });
});

describe("ToolCallCollector", () => {
  it("joins argument deltas and parses them", () => {
    const c = new ToolCallCollector();
    c.add({ id: "a", function: { name: "read_file", arguments: '{"pa' } });
    c.add({ function: { arguments: 'th":"x.ts"}' } });
    c.add({ id: "b", function: { name: "ls", arguments: "" } });
    expect(c.finish()).toEqual([
      { id: "a", name: "read_file", input: { path: "x.ts" } },
      { id: "b", name: "ls", input: {} },
    ]);
  });

  it("gives up on unparseable arguments with an empty object", () => {
    const c = new ToolCallCollector();
    c.add({ id: "a", function: { name: "x", arguments: "{oops" } });
    expect(c.finish()).toEqual([{ id: "a", name: "x", input: {} }]);
  });
});

const llm = (over: Record<string, unknown> = {}) =>
  ({
    title: "Claude Sonnet",
    providerName: "anthropic",
    underlyingProviderName: "anthropic",
    model: "claude-sonnet-4-5",
    contextLength: 200_000,
    completionOptions: { maxTokens: 8_000 },
    capabilities: { tools: true },
    ...over,
  }) as any;

describe("language model provider", () => {
  it("describes models from the config without keys", () => {
    const info = modelInfo(llm({ apiKey: "sk-secret" }), "Claude Sonnet");
    expect(info).toMatchObject({
      id: "Claude Sonnet",
      name: "Claude Sonnet",
      family: "anthropic",
      version: "claude-sonnet-4-5",
      maxInputTokens: 192_000,
      maxOutputTokens: 8_000,
      capabilities: { toolCalling: true, imageInput: false },
    });
    expect(JSON.stringify(info)).not.toContain("sk-secret");
  });

  it("lists each title once, and nothing when turned off", () => {
    const p = new ContinuedLanguageModelChatProvider();
    p.update([llm(), llm(), llm({ title: "GPT-5", model: "gpt-5" })]);
    expect(p.provideLanguageModelChatInformation().map((m) => m.id)).toEqual([
      "Claude Sonnet",
      "GPT-5",
    ]);
    p.setEnabled(false);
    expect(p.provideLanguageModelChatInformation()).toEqual([]);
  });

  it("streams text and reports tool calls at the end", async () => {
    async function* stream() {
      yield { role: "assistant", content: "Let me look. " };
      yield {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "t1", function: { name: "ls", arguments: "{}" } }],
      };
      yield { role: "thinking", content: "hidden" };
    }
    const model = llm({ streamChat: vi.fn(() => stream()) });
    const p = new ContinuedLanguageModelChatProvider();
    p.update([model]);
    const [info] = p.provideLanguageModelChatInformation();
    const parts: any[] = [];
    await p.provideLanguageModelChatResponse(
      info,
      [msg(1, [new vscode.LanguageModelTextPart("hi")])],
      {
        toolMode: 1,
        tools: [
          { name: "ls", description: "List", inputSchema: { type: "object" } },
        ],
      } as any,
      { report: (x: unknown) => parts.push(x) },
      {
        isCancellationRequested: false,
        onCancellationRequested: () => ({ dispose() {} }),
      } as any,
    );
    expect(
      parts.map((p) => p.value ?? `${p.name}(${JSON.stringify(p.input)})`),
    ).toEqual(["Let me look. ", "ls({})"]);
    const [, , options] = model.streamChat.mock.calls[0];
    expect(options.tools[0].function).toEqual({
      name: "ls",
      description: "List",
      parameters: { type: "object" },
    });
  });
});

describe("MCP provider", () => {
  const stdio = {
    id: "gh",
    name: "github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_TOKEN: "ghp_secret" },
    cwd: "/work",
  } as any;
  const http = {
    id: "docs",
    name: "docs",
    type: "streamable-http",
    url: "https://mcp.example.com/mcp",
    apiKey: "k-secret",
    requestOptions: { headers: { "X-Team": "core" } },
  } as any;

  it("lists definitions without credentials", () => {
    const p = new ContinuedMcpServerDefinitionProvider();
    p.update([
      stdio,
      http,
      { id: "ws", name: "ws", type: "websocket", url: "ws://x" },
    ] as any);
    const defs = p.provideMcpServerDefinitions() as any[];
    expect(defs.map((d) => d.label)).toEqual(["github", "docs"]);
    expect(JSON.stringify(defs)).not.toMatch(/secret|X-Team/);
    expect(defs[0].cwd).toEqual({ scheme: "file", path: "/work" });
  });

  it("adds credentials only when VS Code starts the server", () => {
    const p = new ContinuedMcpServerDefinitionProvider();
    p.update([stdio, http] as any);
    const [s, h] = p.provideMcpServerDefinitions() as any[];
    expect((p.resolveMcpServerDefinition(s) as any).env).toEqual({
      GITHUB_TOKEN: "ghp_secret",
    });
    expect((p.resolveMcpServerDefinition(h) as any).headers).toEqual({
      "X-Team": "core",
      Authorization: "Bearer k-secret",
    });
  });

  it("leaves out disabled servers and changes version when a secret changes", () => {
    const p = new ContinuedMcpServerDefinitionProvider();
    p.update([{ ...stdio, status: "disabled" }] as any);
    expect(p.provideMcpServerDefinitions()).toEqual([]);
    const a = toDefinition(stdio, false) as any;
    const b = toDefinition(
      { ...stdio, env: { GITHUB_TOKEN: "other" } },
      false,
    ) as any;
    expect(a.version).not.toEqual(b.version);
    expect(a.version).not.toContain("ghp_secret");
  });

  it("fires a change only when the servers change", () => {
    const p = new ContinuedMcpServerDefinitionProvider();
    const fired = vi.fn();
    p.onDidChangeMcpServerDefinitions(fired);
    p.update([stdio] as any);
    p.update([{ ...stdio }] as any);
    expect(fired).toHaveBeenCalledTimes(1);
  });
});
