import { services } from "../services/index.js";
import { getRepoUrl } from "../util/git.js";

import { Tool } from "./types.js";

function parseRepoRemote(
  repoUrl: string,
): { host: string; owner: string; repo: string } | null {
  const normalized = repoUrl.replace(/\.git$/, "");

  const httpsMatch = normalized.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (httpsMatch?.[1] && httpsMatch[2] && httpsMatch[3]) {
    return {
      host: httpsMatch[1],
      owner: httpsMatch[2],
      repo: httpsMatch[3],
    };
  }

  const sshMatch = normalized.match(
    /^(?:ssh:\/\/)?git@([^:/]+)[:/]([^/]+)\/([^/]+)$/,
  );
  if (sshMatch?.[1] && sshMatch[2] && sshMatch[3]) {
    return {
      host: sshMatch[1],
      owner: sshMatch[2],
      repo: sshMatch[3],
    };
  }

  return null;
}

export const githubTool: Tool = {
  name: "GitHub",
  displayName: "GitHub",
  description:
    "Inspect GitHub context for the current repo and discover connected GitHub MCP tools.",
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    properties: {},
  },
  run: async (): Promise<string> => {
    const repoUrl = getRepoUrl();
    const parsedRemote = parseRepoRemote(repoUrl);
    const availableTools =
      typeof services.mcp?.getState === "function"
        ? services.mcp.getState().tools
        : [];
    const githubTools = availableTools.filter((tool) =>
      tool.name.toLowerCase().startsWith("github"),
    );

    const sortedGitHubTools = [...githubTools].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    const lines = [`Repository: ${repoUrl}`];

    if (parsedRemote) {
      lines.push(`Remote host: ${parsedRemote.host}`);
      lines.push(`Repository slug: ${parsedRemote.owner}/${parsedRemote.repo}`);
    } else {
      lines.push("Remote host: unavailable");
      lines.push("Repository slug: unavailable (not a remote repository URL)");
    }

    lines.push(`GitHub MCP tools: ${sortedGitHubTools.length}`);

    if (sortedGitHubTools.length === 0) {
      lines.push("No GitHub MCP tools are currently connected.");
    } else {
      lines.push("Available GitHub MCP tools:");
      lines.push(
        ...sortedGitHubTools.map((tool) =>
          `- ${tool.name}: ${tool.description ?? ""}`.trim(),
        ),
      );
    }

    return lines.join("\n");
  },
};
