import { ToolImpl } from ".";
import { ContextItem } from "../..";
import {
  buildCoordinatorWorkerSystemMessage,
  getCoordinatorScratchpadPath,
} from "../../agent/coordinator/CoordinatorContext";
import {
  appendWorkerScratchpadEntry,
  readWorkerScratchpad,
} from "../../agent/coordinator/WorkerScratchpad";
import { isAbortError } from "../../util/isAbortError";
import { getContinueGlobalPath } from "../../util/paths";
import { appendMailboxMessage } from "../../util/teamMailboxStore";
import {
  finishTeamMemberRun,
  getActiveTeam,
  TEAM_LEAD_NAME,
  upsertTeamMember,
  type TeamRecord,
  startTeamMemberRun,
} from "../../util/teamStore";
import { applyToolOverrides } from "../applyToolOverrides";

const DEFAULT_SUBAGENT_MAX_TURNS = 25;
type SubagentProfile = "explore" | "verify" | "coordinator-worker";

function getSubagentProfile(args: unknown): SubagentProfile | undefined {
  const profile =
    typeof (args as { profile?: unknown } | undefined)?.profile === "string"
      ? (args as { profile: string }).profile.trim()
      : "";

  if (
    profile === "explore" ||
    profile === "verify" ||
    profile === "coordinator-worker"
  ) {
    return profile;
  }

  return undefined;
}

function findSubagentModel(
  config: import("../..").ContinueConfig,
  requestedName?: string,
) {
  if (!requestedName) {
    return (
      config.selectedModelByRole.subagent ??
      config.modelsByRole.subagent[0] ??
      null
    );
  }

  return (
    config.modelsByRole.subagent.find(
      (model) => model.title === requestedName || model.model === requestedName,
    ) ?? null
  );
}

function summarizeSubagentResult(
  prompt: string,
  result: Awaited<
    ReturnType<(typeof import("../../agent/AgentRunner"))["runAgent"]>
  >,
): ContextItem[] {
  const lastAssistantMessage = [...result.messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    );

  const finalResponse =
    lastAssistantMessage && typeof lastAssistantMessage.content === "string"
      ? lastAssistantMessage.content
      : result.stopReason === "aborted"
        ? "Subagent was cancelled before producing a final response."
        : "Subagent completed without a final textual response.";

  return [
    {
      name: "Subagent Result",
      description: `stopReason=${result.stopReason}; turns=${result.totalTurns}`,
      content: `Subagent task: ${prompt}\n\n${finalResponse}`,
    },
  ];
}

function buildChildSystemMessage(args: {
  baseSystemMessage?: string;
  coordinatorInstructions?: string;
}): string | undefined {
  const segments = [
    args.baseSystemMessage,
    args.coordinatorInstructions,
  ].filter(
    (segment): segment is string => !!segment && segment.trim().length > 0,
  );

  return segments.length > 0 ? segments.join("\n\n") : undefined;
}

function optionalText(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function getTeammateIdentity(args: {
  explicitName?: string;
  requestedName?: string;
  subagentModelTitle?: string;
  subagentModelName?: string;
}): string | undefined {
  return (
    optionalText(args.explicitName) ??
    optionalText(args.requestedName) ??
    optionalText(args.subagentModelTitle) ??
    optionalText(args.subagentModelName)
  );
}

function getResultStatus(
  stopReason: string,
): "completed" | "failed" | "cancelled" {
  if (stopReason === "aborted") {
    return "cancelled";
  }

  if (stopReason === "error" || stopReason === "error_limit") {
    return "failed";
  }

  return "completed";
}

async function resolveTeamContext(args: {
  sessionId?: string;
  requestedTeamName?: string;
  requestedTeammateName?: string;
  requestedSubagentName?: string;
  subagentModelTitle?: string;
  subagentModelName?: string;
}): Promise<
  | {
      sessionId: string;
      team: TeamRecord;
      teammateName: string;
    }
  | undefined
> {
  if (!args.sessionId) {
    return undefined;
  }

  const activeTeam = await getActiveTeam(args.sessionId);
  const explicitTeamName = optionalText(args.requestedTeamName);

  if (!activeTeam) {
    if (explicitTeamName) {
      throw new Error(
        `No active team exists for this session, so subagent could not join team \"${explicitTeamName}\".`,
      );
    }

    return undefined;
  }

  if (explicitTeamName && activeTeam.teamName !== explicitTeamName) {
    throw new Error(
      `Active team is \"${activeTeam.teamName}\", not \"${explicitTeamName}\".`,
    );
  }

  const teammateName = getTeammateIdentity({
    explicitName: args.requestedTeammateName,
    requestedName: args.requestedSubagentName,
    subagentModelTitle: args.subagentModelTitle,
    subagentModelName: args.subagentModelName,
  });

  if (!teammateName) {
    return undefined;
  }

  return {
    sessionId: args.sessionId,
    team: activeTeam,
    teammateName,
  };
}

async function sendLeadMailboxUpdate(args: {
  sessionId: string;
  team: TeamRecord;
  teammateName: string;
  description?: string;
  text: string;
  status: "completed" | "failed" | "cancelled";
}): Promise<void> {
  if (args.team.leadName === args.teammateName) {
    return;
  }

  await upsertTeamMember(
    args.sessionId,
    args.team.teamName,
    args.teammateName,
    {},
  );
  await appendMailboxMessage(args.sessionId, {
    teamName: args.team.teamName,
    memberName: args.team.leadName || TEAM_LEAD_NAME,
    message: {
      from: args.teammateName,
      text: args.text,
      summary: args.description ?? `${args.teammateName} ${args.status}`,
      timestamp: new Date().toISOString(),
      kind: "message",
      metadata: {
        source: "subagent",
        status: args.status,
      },
    },
  });
}

export const subagentToolImpl: ToolImpl = async (args, extras) => {
  const prompt = typeof args?.prompt === "string" ? args.prompt.trim() : "";
  const requestedName =
    typeof args?.subagent_name === "string"
      ? args.subagent_name.trim()
      : undefined;
  const maxTurns =
    typeof args?.maxTurns === "number"
      ? args.maxTurns
      : DEFAULT_SUBAGENT_MAX_TURNS;
  const description = optionalText(args?.description);
  const profile = getSubagentProfile(args);
  const parentSessionId =
    extras.sessionId ?? ((extras as any)._agentSessionId as string | undefined);

  if (!prompt) {
    return [
      {
        name: "Subagent Result",
        description: "Invalid input",
        content: "`prompt` is required to run a subagent.",
      },
    ];
  }

  if (extras.config.modelsByRole.subagent.length === 0) {
    return [
      {
        name: "Subagent Result",
        description: "No subagent models configured",
        content:
          "No models are configured for the subagent role. Add at least one model with the `subagent` role before using this tool.",
      },
    ];
  }

  const subagentModel = findSubagentModel(extras.config, requestedName);
  if (!subagentModel) {
    const available = extras.config.modelsByRole.subagent
      .map((model) => model.title || model.model)
      .join(", ");
    return [
      {
        name: "Subagent Result",
        description: "Unknown subagent",
        content: `Unknown subagent \"${requestedName}\". Available subagents: ${available}`,
      },
    ];
  }

  const subagentConfig: import("../..").ContinueConfig = {
    ...extras.config,
    selectedModelByRole: {
      ...extras.config.selectedModelByRole,
      chat: subagentModel,
      subagent: subagentModel,
    },
  };

  const overriddenTools = applyToolOverrides(
    extras.config.tools,
    subagentModel.toolOverrides,
  ).tools;
  const { _agentSessionId: _ignoredLegacySessionId, ...childToolExtras } =
    extras as typeof extras & {
      _agentSessionId?: string;
    };

  const teamContext = await resolveTeamContext({
    sessionId: parentSessionId,
    requestedTeamName: args?.team_name,
    requestedTeammateName: args?.teammate_name,
    requestedSubagentName: requestedName,
    subagentModelTitle: subagentModel.title,
    subagentModelName: subagentModel.model,
  });

  if (teamContext) {
    await startTeamMemberRun(teamContext.sessionId, {
      teamName: teamContext.team.teamName,
      teammateName: teamContext.teammateName,
      subagentName: requestedName ?? subagentModel.title ?? subagentModel.model,
      description,
      prompt,
    });
  }

  let scratchpadPath: string | undefined;
  let coordinatorInstructions: string | undefined;

  if (profile === "coordinator-worker" && parentSessionId) {
    scratchpadPath = getCoordinatorScratchpadPath(
      getContinueGlobalPath(),
      parentSessionId,
    );
    coordinatorInstructions = buildCoordinatorWorkerSystemMessage({
      scratchpadPath,
      scratchpadContent: await readWorkerScratchpad(
        scratchpadPath,
        parentSessionId,
      ),
    });
  }

  const systemMessage = buildChildSystemMessage({
    baseSystemMessage:
      subagentModel.baseAgentSystemMessage ??
      subagentModel.baseChatSystemMessage ??
      undefined,
    coordinatorInstructions,
  });

  const { runAgent } = await import("../../agent/AgentRunner");
  try {
    const result = await runAgent({
      prompt,
      llm: subagentModel,
      tools: overriddenTools,
      toolExtras: {
        ...childToolExtras,
        sessionId: parentSessionId,
        llm: subagentModel,
        config: subagentConfig,
      },
      systemMessage,
      maxTurns,
      sessionMemory: false,
    });

    const summary = summarizeSubagentResult(prompt, result);
    const resultText = summary[0]?.content ?? "Subagent completed.";
    const resultStatus = getResultStatus(result.stopReason);

    if (teamContext) {
      await finishTeamMemberRun(teamContext.sessionId, {
        teamName: teamContext.team.teamName,
        teammateName: teamContext.teammateName,
        status: resultStatus,
        result: resultText,
      });
      await sendLeadMailboxUpdate({
        sessionId: teamContext.sessionId,
        team: teamContext.team,
        teammateName: teamContext.teammateName,
        description,
        text: resultText,
        status: resultStatus,
      });
    }

    if (scratchpadPath && parentSessionId) {
      await appendWorkerScratchpadEntry(scratchpadPath, parentSessionId, {
        agentName: subagentModel.title || subagentModel.model,
        prompt,
        response: resultText,
        status: resultStatus,
        profile,
      });
    }

    return summary;
  } catch (error) {
    if (teamContext) {
      const message = error instanceof Error ? error.message : String(error);
      const status = isAbortError(error) ? "cancelled" : "failed";
      await finishTeamMemberRun(teamContext.sessionId, {
        teamName: teamContext.team.teamName,
        teammateName: teamContext.teammateName,
        status,
        result: message,
      });
      await sendLeadMailboxUpdate({
        sessionId: teamContext.sessionId,
        team: teamContext.team,
        teammateName: teamContext.teammateName,
        description,
        text: message,
        status,
      });
    }

    if (scratchpadPath && parentSessionId) {
      const message = error instanceof Error ? error.message : String(error);
      await appendWorkerScratchpadEntry(scratchpadPath, parentSessionId, {
        agentName: subagentModel.title || subagentModel.model,
        prompt,
        response: message,
        status: isAbortError(error) ? "cancelled" : "failed",
        profile,
      });
    }

    throw error;
  }
};
