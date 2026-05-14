import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("config and status tools", () => {
  let globalDir: string;

  beforeEach(async () => {
    globalDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "yuto-core-config-status-"),
    );
    process.env.YUTOAGENTIC_GLOBAL_DIR = globalDir;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    await fs.rm(globalDir, { recursive: true, force: true });
  });

  it("reports configured models, config path, and MCP server summaries", async () => {
    const { configToolImpl } = await import("./configStatus");

    const extras = {
      ide: {
        getIdeInfo: vi.fn().mockResolvedValue({
          name: "VS Code",
          version: "1.100.0",
          remoteName: "",
        }),
      },
      config: {
        tools: [],
        mcpServerStatuses: [
          {
            id: "github-cloud",
            name: "GitHub Cloud",
            type: "sse",
            url: "https://example.com/sse",
            status: "connected",
            errors: [],
            infos: [],
            isProtectedResource: false,
            prompts: [{}],
            tools: [{}, {}],
            resources: [{}],
            resourceTemplates: [],
          },
        ],
        modelsByRole: {
          chat: [
            { provider: "openai", title: "GPT-4.1", model: "gpt-4.1" },
            {
              provider: "anthropic",
              title: "Claude Sonnet",
              model: "claude-sonnet",
            },
          ],
          subagent: [
            {
              provider: "openai",
              title: "GPT-4.1 Mini",
              model: "gpt-4.1-mini",
            },
          ],
        },
        selectedModelByRole: {
          chat: { provider: "openai", title: "GPT-4.1", model: "gpt-4.1" },
          subagent: {
            provider: "openai",
            title: "GPT-4.1 Mini",
            model: "gpt-4.1-mini",
          },
        },
      },
    } as any;

    const models = await configToolImpl({ setting: "model" }, extras);
    expect(models[0]?.content).toContain("chat=openai/GPT-4.1");
    expect(models[0]?.content).toContain("subagent=openai/GPT-4.1 Mini");

    const availableModels = await configToolImpl(
      { setting: "available_models" },
      extras,
    );
    expect(availableModels[0]?.content).toContain("chat[0]=openai/GPT-4.1");
    expect(availableModels[0]?.content).toContain(
      "subagent[0]=openai/GPT-4.1 Mini",
    );

    const configPath = await configToolImpl({ setting: "config_path" }, extras);
    expect(configPath[0]?.content).toBe(path.join(globalDir, "config.yaml"));

    const mcpServers = await configToolImpl({ setting: "mcp_servers" }, extras);
    expect(mcpServers[0]?.content).toBe(
      "GitHub Cloud: connected (2 tools, 1 prompts, 1 resources)",
    );
  });

  it("reports runtime status including MCP, task, and team summaries", async () => {
    const { statusToolImpl } = await import("./configStatus");
    const { createAgentTask } = await import("../../util/taskStore");
    const { createTeam } = await import("../../util/teamStore");
    const { appendMailboxMessage } = await import(
      "../../util/teamMailboxStore"
    );

    await createAgentTask("config-status-session", {
      subject: "Trace tool routing",
      description: "Inspect the core tool dispatcher",
    });
    await createTeam("config-status-session", {
      teamName: "Coordination",
      description: "Handle review and execution",
    });
    await appendMailboxMessage("config-status-session", {
      teamName: "Coordination",
      memberName: "team-lead",
      message: {
        from: "reviewer",
        text: "I found the owning file.",
        timestamp: "2026-05-14T00:00:00.000Z",
        kind: "message",
      },
    });

    const result = await statusToolImpl({}, {
      sessionId: "config-status-session",
      ide: {
        getIdeInfo: vi.fn().mockResolvedValue({
          name: "VS Code",
          version: "1.100.0",
          remoteName: "ssh-remote",
        }),
      },
      config: {
        tools: [{}, {}, {}],
        mcpServerStatuses: [
          {
            id: "github-cloud",
            name: "GitHub Cloud",
            type: "sse",
            url: "https://example.com/sse",
            status: "connected",
            errors: [],
            infos: [],
            isProtectedResource: false,
            prompts: [],
            tools: [{}],
            resources: [],
            resourceTemplates: [],
          },
          {
            id: "linear",
            name: "Linear",
            type: "sse",
            url: "https://example.com/linear",
            status: "connecting",
            errors: [],
            infos: [],
            isProtectedResource: false,
            prompts: [],
            tools: [],
            resources: [],
            resourceTemplates: [],
          },
        ],
        selectedModelByRole: {
          chat: { provider: "openai", title: "GPT-4.1", model: "gpt-4.1" },
          subagent: {
            provider: "openai",
            title: "GPT-4.1 Mini",
            model: "gpt-4.1-mini",
          },
        },
      },
    } as any);

    expect(result[0]?.content).toContain("IDE: VS Code 1.100.0 (ssh-remote)");
    expect(result[0]?.content).toContain("Chat model: openai/GPT-4.1");
    expect(result[0]?.content).toContain("Subagent model: openai/GPT-4.1 Mini");
    expect(result[0]?.content).toContain("Configured tools: 3");
    expect(result[0]?.content).toContain("MCP servers: 2 total (1 connected)");
    expect(result[0]?.content).toContain("Tracked tasks: 1 total (1 active)");
    expect(result[0]?.content).toContain(
      "Session team: Coordination (1 members, 1 unread mailbox items)",
    );
  });
});
