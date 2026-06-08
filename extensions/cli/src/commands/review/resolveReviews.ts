import * as fs from "fs";
import * as path from "path";

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
 * 3. Local .continue/agents/*.md and .continue/checks/*.md (fallback)
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

  // Source 3: Local .continue/agents/*.md and .continue/checks/*.md
  const localReviews = resolveFromLocal();
  if (localReviews.length > 0) {
    return localReviews;
  }

  return [];
}

/**
 * Hub review resolution has been removed.
 */
async function resolveFromHub(): Promise<ResolvedReview[]> {
  return [];
}

/**
 * Resolve reviews from local .continue/agents/*.md and .continue/checks/*.md files.
 * Agents take precedence over checks if the same filename exists in both directories.
 */
function resolveFromLocal(): ResolvedReview[] {
  const cwd = process.cwd();
  const dirs = [
    path.join(cwd, ".continue", "agents"),
    path.join(cwd, ".continue", "checks"),
  ];

  const seen = new Set<string>();
  const results: ResolvedReview[] = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    try {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        if (!seen.has(file)) {
          seen.add(file);
          results.push({
            name: path.basename(file, ".md").replace(/[-_]/g, " "),
            source: path.join(dir, file),
            sourceType: "local" as const,
          });
        }
      }
    } catch {
      // Directory read failed, skip
    }
  }

  return results;
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
