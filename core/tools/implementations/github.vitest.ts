import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolExtras } from "../..";

const { mockGetStatuses } = vi.hoisted(() => ({
  mockGetStatuses: vi.fn(),
}));

vi.mock("../../context/mcp/MCPManagerSingleton", () => ({
  MCPManagerSingleton: {
    getInstance: () => ({
      getStatuses: mockGetStatuses,
    }),
  },
}));

import { githubToolImpl } from "./github";

function createExtras(repoUrl: string): ToolExtras {
  return {
    ide: {
      getWorkspaceDirs: vi.fn().mockResolvedValue(["file:///workspace"]),
      subprocess: vi.fn().mockResolvedValue([repoUrl, ""]),
    } as any,
    llm: {} as any,
    fetch: (() => {
      throw new Error("unused");
    }) as any,
    tool: {} as any,
    config: {} as any,
  } as ToolExtras;
}

describe("githubToolImpl", () => {
  beforeEach(() => {
    mockGetStatuses.mockReset();
  });

  it("reports repository slug and connected GitHub MCP tools", async () => {
    mockGetStatuses.mockReturnValue([
      {
        name: "GitHub Cloud",
        tools: [
          {
            name: "create_issue",
            description: "Create a GitHub issue",
          },
        ],
      },
      {
        name: "GitHub Enterprise",
        tools: [
          {
            name: "github_list_prs",
            description: "List pull requests",
          },
        ],
      },
    ]);

    const result = await githubToolImpl(
      {},
      createExtras("git@github.com:octo-org/octo-repo.git"),
    );

    expect(result[0]?.content).toContain(
      "Repository: git@github.com:octo-org/octo-repo.git",
    );
    expect(result[0]?.content).toContain("Remote host: github.com");
    expect(result[0]?.content).toContain("Repository slug: octo-org/octo-repo");
    expect(result[0]?.content).toContain("GitHub MCP tools: 2");
    expect(result[0]?.content).toContain(
      "- GitHub Cloud/create_issue: Create a GitHub issue",
    );
    expect(result[0]?.content).toContain(
      "- GitHub Enterprise/github_list_prs: List pull requests",
    );
  });

  it("handles non-GitHub remotes and no connected GitHub tools", async () => {
    mockGetStatuses.mockReturnValue([
      {
        name: "Linear",
        tools: [
          {
            name: "linear_create_issue",
            description: "Create a Linear issue",
          },
        ],
      },
    ]);

    const result = await githubToolImpl(
      {},
      createExtras("ssh://git@example.internal/team/repo"),
    );

    expect(result[0]?.content).toContain("Remote host: example.internal");
    expect(result[0]?.content).toContain("Repository slug: team/repo");
    expect(result[0]?.content).toContain("GitHub MCP tools: 0");
    expect(result[0]?.content).toContain(
      "No GitHub MCP tools are currently connected.",
    );
  });
});
