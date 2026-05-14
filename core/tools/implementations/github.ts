import { ToolExtras } from "../..";
import { MCPManagerSingleton } from "../../context/mcp/MCPManagerSingleton";
import { ToolImpl } from ".";

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

async function getWorkspaceDir(extras: ToolExtras): Promise<string> {
  const workspaceDirs = await extras.ide.getWorkspaceDirs();
  if (workspaceDirs.length === 0) {
    throw new Error("No workspace directory found.");
  }
  return workspaceDirs[0];
}

async function getRepoUrl(extras: ToolExtras): Promise<string> {
  const workspaceDir = await getWorkspaceDir(extras);
  const [stdout, stderr] = await extras.ide.subprocess(
    "git remote get-url origin",
    workspaceDir,
  );
  const repoUrl = stdout.trim() || stderr.trim();

  if (!repoUrl) {
    throw new Error("Could not determine git remote URL.");
  }

  return repoUrl;
}

export const githubToolImpl: ToolImpl = async (_args, extras) => {
  const repoUrl = await getRepoUrl(extras);
  const parsedRemote = parseRepoRemote(repoUrl);
  const githubTools = MCPManagerSingleton.getInstance()
    .getStatuses()
    .flatMap((status) => {
      const isGithubServer = status.name.toLowerCase().includes("github");
      return status.tools
        .filter(
          (tool) =>
            isGithubServer || tool.name.toLowerCase().startsWith("github"),
        )
        .map((tool) => ({
          serverName: status.name,
          toolName: tool.name,
          description: tool.description ?? "",
        }));
    });

  const sortedGitHubTools = [...githubTools].sort((left, right) =>
    left.toolName.localeCompare(right.toolName),
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
        `- ${tool.serverName}/${tool.toolName}: ${tool.description}`.trim(),
      ),
    );
  }

  return [
    {
      name: "GitHub",
      description: "GitHub repository context",
      content: lines.join("\n"),
    },
  ];
};
