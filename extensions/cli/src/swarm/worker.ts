import {
  appendWorkerScratchpadEntry,
  readWorkerScratchpad,
} from "core/agent/coordinator/WorkerScratchpad.js";
import {
  buildCoordinatorWorkerSystemMessage,
  getCoordinatorScratchpadPath,
} from "core/agent/coordinator/CoordinatorContext.js";

import type { BaseCommandOptions } from "../commands/BaseCommandOptions.js";
import { fireTeammateIdle } from "../hooks/fireHook.js";
import type { PermissionMode } from "../permissions/types.js";
import { getCurrentSession } from "../session.js";
import {
  initializeServices,
  serviceContainer,
  services,
} from "../services/index.js";
import { SERVICE_NAMES, type ModelServiceState } from "../services/types.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";
import { logger } from "../util/logger.js";

import {
  appendMailboxMessage,
  takeUnreadMailboxMessages,
  type SwarmMailboxMessage,
} from "./mailbox.js";
import { setSwarmIdentity } from "./identity.js";
import {
  TEAM_LEAD_NAME,
  formatSwarmAgentId,
  type SwarmBackend,
  type SwarmTeamMember,
  upsertSwarmTeamMember,
} from "./teamRuntime.js";

export const SWARM_WORKER_CONFIG_ENV_VAR = "YUTO_SWARM_WORKER_CONFIG";

export interface SwarmWorkerConfig {
  agentId: string;
  agentName: string;
  teamName: string;
  parentSessionId?: string;
  color?: string;
  planModeRequired?: boolean;
  profile?: "explore" | "verify" | "coordinator-worker";
  permissionMode?: PermissionMode;
  backend: Extract<SwarmBackend, "process" | "tmux" | "in-process">;
  model?: string;
  agentType?: string;
  agentSystemPrompt?: string;
  description?: string;
  options?: BaseCommandOptions & {
    verbose?: boolean;
    betaSubagentTool?: boolean;
  };
  pollIntervalMs?: number;
}

export interface DrainMailboxResult {
  processedCount: number;
  shouldExit: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWorkerPermissionMode(config: SwarmWorkerConfig): PermissionMode {
  if (config.profile === "explore") {
    return "explore";
  }

  if (config.profile === "verify") {
    return "verify";
  }

  if (config.profile === "coordinator-worker") {
    return "coordinator";
  }

  if (config.permissionMode) {
    return config.permissionMode;
  }

  if (config.planModeRequired) {
    return "plan";
  }

  return "auto";
}

function shouldUseCoordinatorScratchpad(config: SwarmWorkerConfig): boolean {
  return (
    config.profile === "coordinator-worker" ||
    getWorkerPermissionMode(config) === "coordinator"
  );
}

function getScratchpadPath(config: SwarmWorkerConfig): string | undefined {
  if (!config.parentSessionId || !shouldUseCoordinatorScratchpad(config)) {
    return undefined;
  }

  return getCoordinatorScratchpadPath(
    process.env.YUTOAGENTIC_GLOBAL_DIR || undefined,
    config.parentSessionId,
  );
}

function summarizeResult(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "Worker completed without a text response.";
  }

  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

function isShutdownMessage(message: SwarmMailboxMessage): boolean {
  return (
    message.kind === "control" &&
    ((message.metadata?.action as string | undefined) === "shutdown" ||
      message.text.trim().toLowerCase() === "shutdown")
  );
}

function encodeBase64Json(input: unknown): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

export function encodeSwarmWorkerConfig(config: SwarmWorkerConfig): string {
  return encodeBase64Json(config);
}

export function loadSwarmWorkerConfigFromEnv(
  rawValue = process.env[SWARM_WORKER_CONFIG_ENV_VAR],
): SwarmWorkerConfig {
  if (!rawValue) {
    throw new Error(
      `${SWARM_WORKER_CONFIG_ENV_VAR} is required for swarm worker startup.`,
    );
  }

  const decoded = Buffer.from(rawValue, "base64url").toString("utf8");
  const parsed = JSON.parse(decoded) as SwarmWorkerConfig;

  if (!parsed.agentId || !parsed.agentName || !parsed.teamName) {
    throw new Error("Swarm worker config is missing identity fields.");
  }

  return parsed;
}

function buildMemberSnapshot(
  config: SwarmWorkerConfig,
  overrides: Partial<SwarmTeamMember>,
): SwarmTeamMember {
  return {
    agentId:
      config.agentId || formatSwarmAgentId(config.agentName, config.teamName),
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
    isActive: overrides.isActive,
    status: overrides.status,
    lastPrompt: overrides.lastPrompt,
    lastResult: overrides.lastResult,
    lastRunAt: overrides.lastRunAt,
    finishedAt: overrides.finishedAt,
  };
}

async function updateWorkerMember(
  config: SwarmWorkerConfig,
  overrides: Partial<SwarmTeamMember>,
): Promise<void> {
  await upsertSwarmTeamMember({
    teamName: config.teamName,
    member: buildMemberSnapshot(config, overrides),
  });
}

async function buildWorkerSystemMessage(
  config: SwarmWorkerConfig,
  mode: PermissionMode,
): Promise<string> {
  const segments: string[] = [];

  if (services.systemMessage) {
    const base = await services.systemMessage.getSystemMessage(mode);
    if (base.trim()) {
      segments.push(base);
    }
  }

  if (config.agentSystemPrompt?.trim()) {
    segments.push(config.agentSystemPrompt.trim());
  }

  const scratchpadPath = getScratchpadPath(config);
  if (scratchpadPath && config.parentSessionId) {
    const scratchpadContent = await readWorkerScratchpad(
      scratchpadPath,
      config.parentSessionId,
    );
    segments.push(
      buildCoordinatorWorkerSystemMessage({
        scratchpadPath,
        scratchpadContent,
      }),
    );
  }

  return segments.filter(Boolean).join("\n\n");
}

async function runMailboxPrompt(
  config: SwarmWorkerConfig,
  message: SwarmMailboxMessage,
): Promise<string> {
  const modelState = await serviceContainer.get<ModelServiceState>(
    SERVICE_NAMES.MODEL,
  );

  if (!modelState.model || !modelState.llmApi) {
    throw new Error("Swarm worker model service is not ready.");
  }

  const mode = getWorkerPermissionMode(config);
  const originalGetSystemMessage = services.systemMessage?.getSystemMessage;
  const systemMessage = await buildWorkerSystemMessage(config, mode);

  if (services.systemMessage) {
    services.systemMessage.getSystemMessage = async () => systemMessage;
  }

  try {
    await updateWorkerMember(config, {
      sessionId: getCurrentSession().sessionId,
      isActive: true,
      status: "running",
      lastPrompt: message.text,
      lastRunAt: Date.now(),
    });

    services.chatHistory.addUserMessage(message.text);

    const response = await streamChatResponse(
      services.chatHistory.getHistory(),
      modelState.model,
      modelState.llmApi,
      new AbortController(),
    );

    const scratchpadPath = getScratchpadPath(config);
    if (scratchpadPath && config.parentSessionId) {
      await appendWorkerScratchpadEntry(
        scratchpadPath,
        config.parentSessionId,
        {
          agentName: config.agentName,
          prompt: message.text,
          response,
          status: "completed",
          profile: config.profile,
        },
      );
    }

    await updateWorkerMember(config, {
      sessionId: getCurrentSession().sessionId,
      isActive: true,
      status: "completed",
      lastPrompt: message.text,
      lastResult: response,
      lastRunAt: Date.now(),
      finishedAt: Date.now(),
    });

    await appendMailboxMessage({
      teamName: config.teamName,
      teammateName: TEAM_LEAD_NAME,
      message: {
        from: config.agentName,
        text: response,
        timestamp: new Date().toISOString(),
        kind: "message",
        summary: summarizeResult(response),
        metadata: {
          source: "swarm-worker",
          agentId: config.agentId,
        },
      },
    });

    await fireTeammateIdle(config.agentName, config.teamName);
    return response;
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    const scratchpadPath = getScratchpadPath(config);

    if (scratchpadPath && config.parentSessionId) {
      await appendWorkerScratchpadEntry(
        scratchpadPath,
        config.parentSessionId,
        {
          agentName: config.agentName,
          prompt: message.text,
          response: messageText,
          status: "failed",
          profile: config.profile,
        },
      );
    }

    await updateWorkerMember(config, {
      sessionId: getCurrentSession().sessionId,
      isActive: true,
      status: "failed",
      lastPrompt: message.text,
      lastResult: messageText,
      lastRunAt: Date.now(),
      finishedAt: Date.now(),
    });

    await appendMailboxMessage({
      teamName: config.teamName,
      teammateName: TEAM_LEAD_NAME,
      message: {
        from: config.agentName,
        text: messageText,
        timestamp: new Date().toISOString(),
        kind: "control",
        summary: `Worker failed: ${summarizeResult(messageText)}`,
        metadata: {
          source: "swarm-worker",
          agentId: config.agentId,
          status: "failed",
        },
      },
    });

    await fireTeammateIdle(config.agentName, config.teamName);
    throw error;
  } finally {
    if (services.systemMessage && originalGetSystemMessage) {
      services.systemMessage.getSystemMessage = originalGetSystemMessage;
    }
  }
}

export async function initializeSwarmWorker(
  config: SwarmWorkerConfig,
): Promise<void> {
  setSwarmIdentity({
    agentId: config.agentId,
    agentName: config.agentName,
    teamName: config.teamName,
    color: config.color,
    parentSessionId: config.parentSessionId,
    planModeRequired: config.planModeRequired,
  });

  const options = {
    ...(config.options ?? {}),
    model: config.model ? [config.model] : config.options?.model,
    betaSubagentTool: config.options?.betaSubagentTool ?? true,
  };

  await initializeServices({
    options,
    headless: true,
    toolPermissionOverrides: {
      mode: getWorkerPermissionMode(config),
      allow: config.options?.allow,
      ask: config.options?.ask,
      exclude: config.options?.exclude,
    },
  });

  await updateWorkerMember(config, {
    sessionId: getCurrentSession().sessionId,
    isActive: true,
    status: "idle",
    joinedAt: Date.now(),
  });
}

export async function drainSwarmMailboxOnce(
  config: SwarmWorkerConfig,
): Promise<DrainMailboxResult> {
  const messages = await takeUnreadMailboxMessages(
    config.teamName,
    config.agentName,
  );

  let processedCount = 0;
  for (const message of messages) {
    if (isShutdownMessage(message)) {
      await updateWorkerMember(config, {
        sessionId: getCurrentSession().sessionId,
        isActive: false,
        status: "cancelled",
        lastResult: message.text,
        lastRunAt: Date.now(),
        finishedAt: Date.now(),
      });
      await fireTeammateIdle(config.agentName, config.teamName);
      return { processedCount, shouldExit: true };
    }

    await runMailboxPrompt(config, message);
    processedCount += 1;
  }

  return { processedCount, shouldExit: false };
}

export async function runSwarmTeammateWorker(): Promise<void> {
  const config = loadSwarmWorkerConfigFromEnv();
  await initializeSwarmWorker(config);

  let shouldExit = false;
  const handleSignal = () => {
    shouldExit = true;
  };

  process.on("SIGTERM", handleSignal);
  process.on("SIGINT", handleSignal);

  try {
    while (!shouldExit) {
      const result = await drainSwarmMailboxOnce(config);
      if (result.shouldExit) {
        shouldExit = true;
        break;
      }

      if (result.processedCount === 0) {
        await sleep(config.pollIntervalMs ?? 750);
      }
    }
  } finally {
    logger.debug("Swarm worker shutting down", {
      agentId: config.agentId,
      teamName: config.teamName,
    });
    process.off("SIGTERM", handleSignal);
    process.off("SIGINT", handleSignal);
    await updateWorkerMember(config, {
      sessionId: getCurrentSession().sessionId,
      isActive: false,
      status: "cancelled",
      finishedAt: Date.now(),
    }).catch(() => undefined);
    setSwarmIdentity(null);
  }
}
