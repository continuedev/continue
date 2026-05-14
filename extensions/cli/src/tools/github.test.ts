import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRepoUrlMock, getMcpStateMock } = vi.hoisted(() => ({
  getRepoUrlMock: vi.fn(),
  getMcpStateMock: vi.fn(),
}));

vi.mock("../util/git.js", () => ({
  getRepoUrl: getRepoUrlMock,
}));

vi.mock("../services/index.js", () => ({
  services: {
    mcp: {
      getState: getMcpStateMock,
    },
  },
}));

describe("GitHub tool", () => {
  beforeEach(() => {
    getRepoUrlMock.mockReset();
    getMcpStateMock.mockReset();
  });

  it("summarizes a GitHub remote and connected MCP tools", async () => {
    getRepoUrlMock.mockReturnValue(
      "https://github.com/yutoagentic/yutoagentic.git",
    );
    getMcpStateMock.mockReturnValue({
      tools: [
        { name: "githubPullRequests", description: "Inspect PRs" },
        { name: "gitStatus", description: "Not a GitHub tool" },
        { name: "githubIssues", description: "Inspect issues" },
      ],
    });

    const { githubTool } = await import("./github.js");
    const output = await githubTool.run({});

    expect(output).toContain(
      "Repository: https://github.com/yutoagentic/yutoagentic.git",
    );
    expect(output).toContain("Remote host: github.com");
    expect(output).toContain("Repository slug: yutoagentic/yutoagentic");
    expect(output).toContain("GitHub MCP tools: 2");
    expect(output).toContain("- githubIssues: Inspect issues");
    expect(output).toContain("- githubPullRequests: Inspect PRs");
    expect(output).not.toContain("gitStatus");
  });

  it("handles local workspace paths with no GitHub MCP tools", async () => {
    getRepoUrlMock.mockReturnValue("/tmp/not-a-repo");
    getMcpStateMock.mockReturnValue({ tools: [] });

    const { githubTool } = await import("./github.js");
    const output = await githubTool.run({});

    expect(output).toContain("Repository: /tmp/not-a-repo");
    expect(output).toContain("Remote host: unavailable");
    expect(output).toContain(
      "Repository slug: unavailable (not a remote repository URL)",
    );
    expect(output).toContain("GitHub MCP tools: 0");
    expect(output).toContain("No GitHub MCP tools are currently connected.");
  });
});
