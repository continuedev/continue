import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { loadAuthConfig, getAccessToken } from "../../auth/workos.js";
import { env } from "../../env.js";
import { logger } from "../../util/logger.js";

export interface ResolvedReview {
  /** Display name for the review */
  name: string;
  /** Hub slug (org/agent) or local file path */
  source: string;
  /** 'hub' | 'local' */
  sourceType: "hub" | "local";
}

/**
 * Determine which reviews to run, using three sources in order:
 * 1. CLI --agent flags (highest priority)
 * 2. Hub API (if logged in and no --agent flags)
 * 3. Local .continue/agents/*.md (fallback)
 */
export async function resolveReviews(
  agentFlags?: string[],
): Promise<ResolvedReview[]> {
  // Source 1: CLI --agent flags
  if (agentFlags && agentFlags.length > 0) {
    return agentFlags.map((agent) => ({
      name: agentDisplayName(agent),
      source: agent,
      sourceType: isLocalPath(agent) ? "local" : "hub",
    }));
  }

  // Source 2: Hub API (silent failure if not logged in)
  const hubReviews = await resolveFromHub();
  if (hubReviews.length > 0) {
    return hubReviews;
  }

  // Source 3: Local .continue/agents/*.md
  const localReviews = resolveFromLocal();
  if (localReviews.length > 0) {
    return localReviews;
  }

  return [];
}

/**
 * Try to resolve reviews from the hub API based on the current repo.
 */
async function resolveFromHub(): Promise<ResolvedReview[]> {
  try {
    const authConfig = loadAuthConfig();
    if (!authConfig) {
      return [];
    }

    const accessToken = getAccessToken(authConfig);
    if (!accessToken) {
      return [];
    }

    // Get the repo URL from git
    let repoUrl: string;
    try {
      repoUrl = execSync("git config --get remote.origin.url", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      return [];
    }

    if (!repoUrl) {
      return [];
    }

    const url = new URL("api/checks/resolve", env.apiBase);
    url.searchParams.set("repoUrl", repoUrl);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      logger.debug(`Hub review resolution returned ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      checks: Array<{ slug: string; name: string }>;
    };
    return (data.checks || []).map((c) => ({
      name: c.name,
      source: c.slug,
      sourceType: "hub" as const,
    }));
  } catch (e) {
    logger.debug("Hub review resolution failed", { error: e });
    return [];
  }
}

/**
 * Resolve reviews from local .continue/agents/*.md files.
 */
function resolveFromLocal(): ResolvedReview[] {
  const agentsDir = path.join(process.cwd(), ".continue", "agents");
  if (!fs.existsSync(agentsDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
    return files.map((file) => ({
      name: path.basename(file, ".md").replace(/[-_]/g, " "),
      source: path.join(agentsDir, file),
      sourceType: "local" as const,
    }));
  } catch {
    return [];
  }
}

function isLocalPath(agent: string): boolean {
  return (
    agent.startsWith(".") ||
    agent.startsWith("/") ||
    agent.startsWith("~") ||
    agent.endsWith(".md") ||
    agent.endsWith(".yaml") ||
    agent.endsWith(".yml") ||
    // Windows absolute path (C:\...)
    /^[A-Za-z]:[/\\]/.test(agent)
  );
}

function agentDisplayName(agent: string): string {
  if (isLocalPath(agent)) {
    return path.basename(agent, path.extname(agent)).replace(/[-_]/g, " ");
  }
  // Hub slug: "org/agent-name" -> "agent-name" -> "agent name"
  const parts = agent.split("/");
  return (parts[parts.length - 1] || agent).replace(/[-_]/g, " ");
}
