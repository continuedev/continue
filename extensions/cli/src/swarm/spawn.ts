import { fork, execFile } from "child_process";
import { promisify } from "util";

import { quote } from "shell-quote";

import { backgroundJobService } from "../services/BackgroundJobService.js";
import { logger } from "../util/logger.js";

import { appendMailboxMessage } from "./mailbox.js";
import {
  TEAM_LEAD_NAME,
  readSwarmTeam,
  sanitizeName,
  type SwarmTeamMember,
  upsertSwarmTeamMember,
} from "./teamRuntime.js";
import {
  encodeSwarmWorkerConfig,
  SWARM_WORKER_CONFIG_ENV_VAR,
  type SwarmWorkerConfig,
} from "./worker.js";

const execFileAsync = promisify(execFile);
const TMUX_SESSION_NAME = "yt-swarm";

export interface SpawnSwarmTeammateInput {
  workerConfig: SwarmWorkerConfig;
  prompt: string;
  cwd?: string;
}

export interface SpawnSwarmTeammateResult {
  status: "spawned" | "queued";
  backend: "process" | "tmux";
  jobId?: string;
  paneId?: string;
  sessionName?: string;
  summary: string;
}

function getWorkerEntrypoint(): { entrypoint: string; execArgv: string[] } {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    throw new Error("Cannot determine CLI entrypoint for swarm worker launch.");
  }

  return {
    entrypoint,
    execArgv: [...process.execArgv],
  };
}

function buildWorkerCommandPreview(config: SwarmWorkerConfig): string {
  return `yt --internal-teammate-worker ${config.agentName}@${config.teamName}`;
}

function buildWorkerMember(
  config: SwarmWorkerConfig,
  overrides: Partial<SwarmTeamMember>,
): SwarmTeamMember {
  return {
    agentId: config.agentId,
    name: config.agentName,
    agentType: config.agentType,
    model: config.model,
    color: config.color,
    planModeRequired: config.planModeRequired,
    joinedAt: overrides.joinedAt ?? Date.now(),
    tmuxPaneId:
      overrides.tmuxPaneId ?? (config.backend === "tmux" ? "tmux" : "process"),
    cwd: overrides.cwd ?? process.cwd(),
    sessionId: overrides.sessionId,
    subscriptions: overrides.subscriptions ?? [],
    backendType: config.backend,
    jobId: overrides.jobId,
    isActive: overrides.isActive,
    status: overrides.status,
    lastPrompt: overrides.lastPrompt,
    lastResult: overrides.lastResult,
    lastRunAt: overrides.lastRunAt,
    finishedAt: overrides.finishedAt,
  };
}

async function queueMailboxPrompt(
  input: SpawnSwarmTeammateInput,
): Promise<void> {
  await appendMailboxMessage({
    teamName: input.workerConfig.teamName,
    teammateName: input.workerConfig.agentName,
    message: {
      from: TEAM_LEAD_NAME,
      text: input.prompt,
      timestamp: new Date().toISOString(),
      kind: "prompt",
      summary:
        input.prompt.length > 80
          ? `${input.prompt.slice(0, 77).trim()}...`
          : input.prompt.trim(),
      metadata: {
        source: "subagent",
        backend: input.workerConfig.backend,
      },
    },
  });
}

async function readExistingWorker(
  config: SwarmWorkerConfig,
): Promise<SwarmTeamMember | undefined> {
  const team = await readSwarmTeam(config.teamName);
  return team?.members.find((member) => member.name === config.agentName);
}

function buildWorkerEnv(config: SwarmWorkerConfig): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [SWARM_WORKER_CONFIG_ENV_VAR]: encodeSwarmWorkerConfig(config),
  };
}

async function spawnProcessWorker(
  input: SpawnSwarmTeammateInput,
): Promise<SpawnSwarmTeammateResult> {
  const { entrypoint, execArgv } = getWorkerEntrypoint();
  const child = fork(entrypoint, ["--internal-teammate-worker"], {
    cwd: input.cwd ?? process.cwd(),
    env: buildWorkerEnv(input.workerConfig),
    execArgv,
    silent: true,
  });

  const job = backgroundJobService.createJobWithProcess(
    buildWorkerCommandPreview(input.workerConfig),
    child,
  );

  if (!job) {
    child.kill();
    throw new Error("Could not register swarm worker background job.");
  }

  child.on("exit", (code) => {
    void upsertSwarmTeamMember({
      teamName: input.workerConfig.teamName,
      member: buildWorkerMember(input.workerConfig, {
        jobId: job.id,
        tmuxPaneId: job.id,
        isActive: false,
        status: code === 0 ? "completed" : "failed",
        finishedAt: Date.now(),
        lastRunAt: Date.now(),
      }),
    }).catch(() => undefined);
  });

  await queueMailboxPrompt(input);
  await upsertSwarmTeamMember({
    teamName: input.workerConfig.teamName,
    member: buildWorkerMember(input.workerConfig, {
      jobId: job.id,
      tmuxPaneId: job.id,
      isActive: true,
      status: "idle",
      lastPrompt: input.prompt,
      lastRunAt: Date.now(),
    }),
  });

  return {
    status: "spawned",
    backend: "process",
    jobId: job.id,
    summary: `Spawned background teammate ${input.workerConfig.agentName} (job ${job.id}).`,
  };
}

async function ensureTmuxSession(): Promise<void> {
  try {
    await execFileAsync("tmux", ["has-session", "-t", TMUX_SESSION_NAME]);
  } catch {
    await execFileAsync("tmux", ["new-session", "-d", "-s", TMUX_SESSION_NAME]);
  }
}

function buildTmuxWorkerCommand(
  config: SwarmWorkerConfig,
  cwd: string,
): string {
  const { entrypoint, execArgv } = getWorkerEntrypoint();
  const envAssignments = [
    `${SWARM_WORKER_CONFIG_ENV_VAR}=${quote([encodeSwarmWorkerConfig(config)])}`,
  ];

  const commandParts = [
    process.execPath,
    ...execArgv,
    entrypoint,
    "--internal-teammate-worker",
  ];

  return `cd ${quote([cwd])} && ${envAssignments.join(" ")} ${quote(
    commandParts,
  )}`;
}

async function spawnTmuxWorker(
  input: SpawnSwarmTeammateInput,
): Promise<SpawnSwarmTeammateResult> {
  const cwd = input.cwd ?? process.cwd();
  const workerCommand = buildTmuxWorkerCommand(input.workerConfig, cwd);

  let paneId = "";
  let sessionName = "current";

  if (process.env.TMUX) {
    const { stdout } = await execFileAsync("tmux", [
      "split-window",
      "-P",
      "-F",
      "#{pane_id}",
      "-h",
      workerCommand,
    ]);
    paneId = stdout.trim();
  } else {
    await ensureTmuxSession();
    const { stdout } = await execFileAsync("tmux", [
      "new-window",
      "-d",
      "-t",
      TMUX_SESSION_NAME,
      "-n",
      sanitizeName(input.workerConfig.agentName) || "teammate",
      "-P",
      "-F",
      "#{pane_id}",
      workerCommand,
    ]);
    paneId = stdout.trim();
    sessionName = TMUX_SESSION_NAME;
  }

  await queueMailboxPrompt(input);
  await upsertSwarmTeamMember({
    teamName: input.workerConfig.teamName,
    member: buildWorkerMember(input.workerConfig, {
      tmuxPaneId: paneId,
      cwd,
      isActive: true,
      status: "idle",
      lastPrompt: input.prompt,
      lastRunAt: Date.now(),
    }),
  });

  return {
    status: "spawned",
    backend: "tmux",
    paneId,
    sessionName,
    summary: `Spawned tmux teammate ${input.workerConfig.agentName} in ${sessionName}:${paneId}.`,
  };
}

export async function spawnSwarmTeammate(
  input: SpawnSwarmTeammateInput,
): Promise<SpawnSwarmTeammateResult> {
  const team = await readSwarmTeam(input.workerConfig.teamName);
  if (!team) {
    throw new Error(
      `Team \"${input.workerConfig.teamName}\" does not exist. Create it first with TeamCreate.`,
    );
  }

  const existingWorker = await readExistingWorker(input.workerConfig);
  if (existingWorker?.isActive) {
    await queueMailboxPrompt(input);
    await upsertSwarmTeamMember({
      teamName: input.workerConfig.teamName,
      member: {
        ...existingWorker,
        lastPrompt: input.prompt,
        lastRunAt: Date.now(),
      },
    });
    return {
      status: "queued",
      backend: input.workerConfig.backend === "tmux" ? "tmux" : "process",
      jobId: existingWorker.jobId,
      paneId: existingWorker.tmuxPaneId,
      summary: `Queued a new mailbox task for ${input.workerConfig.agentName}.`,
    };
  }

  logger.debug("Spawning swarm teammate", {
    teamName: input.workerConfig.teamName,
    teammate: input.workerConfig.agentName,
    backend: input.workerConfig.backend,
  });

  if (input.workerConfig.backend === "tmux") {
    return spawnTmuxWorker(input);
  }

  return spawnProcessWorker(input);
}

export async function cleanupSwarmTeammates(teamName: string): Promise<number> {
  const team = await readSwarmTeam(teamName);
  if (!team) {
    return 0;
  }

  let cleaned = 0;
  for (const member of team.members) {
    if (member.name === TEAM_LEAD_NAME) {
      continue;
    }

    if (member.backendType === "process" && member.jobId) {
      if (backgroundJobService.cancelJob(member.jobId)) {
        cleaned += 1;
      }
      continue;
    }

    if (member.backendType === "tmux" && member.tmuxPaneId) {
      try {
        await execFileAsync("tmux", ["kill-pane", "-t", member.tmuxPaneId]);
        cleaned += 1;
      } catch {
        // Ignore panes that have already exited.
      }
    }
  }

  return cleaned;
}
