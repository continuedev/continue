import type {
  ISwarmBackend,
  SwarmAgentConfig,
  SwarmAgentStatus,
  SwarmSpawnResult,
} from "core/agent/coordinator/ISwarmBackend.js";

import { getCurrentSession } from "../session.js";

import { spawnSwarmTeammate } from "./spawn.js";
import { readSwarmTeam, upsertSwarmTeamMember } from "./teamRuntime.js";
import type { SwarmWorkerConfig } from "./worker.js";

function resolveBackend(
  config: SwarmAgentConfig,
): Extract<SwarmWorkerConfig["backend"], "in-process" | "process" | "tmux"> {
  if (
    config.backend === "tmux" ||
    config.backend === "process" ||
    config.backend === "in-process"
  ) {
    return config.backend;
  }
  return "process";
}

/**
 * CLI implementation of ISwarmBackend.
 *
 * Delegates to the existing spawn.ts helpers (process / tmux backends) and
 * reads team state from the on-disk team roster via teamRuntime.ts.
 */
export class CliSwarmBackend implements ISwarmBackend {
  async spawnAgent(config: SwarmAgentConfig): Promise<SwarmSpawnResult> {
    const workerConfig: SwarmWorkerConfig = {
      agentId: config.agentId,
      agentName: config.agentName,
      teamName: config.teamName,
      backend: resolveBackend(config),
      model: config.model,
      agentSystemPrompt: config.agentSystemPrompt,
      parentSessionId: getCurrentSession().sessionId,
    };

    const result = await spawnSwarmTeammate({
      workerConfig,
      prompt: config.prompt,
      cwd: config.cwd,
    });

    return {
      status: result.status,
      handle: result.jobId ?? result.paneId,
      summary: result.summary,
    };
  }

  async stopAgent(agentId: string, teamName: string): Promise<void> {
    const team = await readSwarmTeam(teamName);
    if (!team) {
      return;
    }

    const member = team.members.find((m) => m.agentId === agentId);
    if (!member) {
      return;
    }

    await upsertSwarmTeamMember({
      teamName,
      member: {
        ...member,
        isActive: false,
        status: "cancelled",
        finishedAt: Date.now(),
      },
    });
  }

  async getAgentStatus(
    agentId: string,
    teamName: string,
  ): Promise<SwarmAgentStatus | null> {
    const team = await readSwarmTeam(teamName);
    if (!team) {
      return null;
    }

    const member = team.members.find((m) => m.agentId === agentId);
    if (!member) {
      return null;
    }

    return member.status ?? (member.isActive ? "running" : "idle");
  }
}

/** Singleton instance for use within the CLI runtime. */
export const cliSwarmBackend = new CliSwarmBackend();
