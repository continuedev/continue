import { services } from "../services/index.js";
import { serviceContainer } from "../services/ServiceContainer.js";
import { ModelServiceState, SERVICE_NAMES } from "../services/types.js";
import { executeSubAgent } from "../subagent/executor.js";
import {
  generateSubagentToolDescription,
  getSubagent,
  getAgentNames as getSubagentNames,
} from "../subagent/get-agents.js";
import { fireTeammateIdle } from "../hooks/fireHook.js";
import { SUBAGENT_TOOL_META } from "../subagent/index.js";
import { spawnSwarmTeammate } from "../swarm/spawn.js";
import {
  finishTeamMemberRun,
  getActiveTeam,
  startTeamMemberRun,
} from "../util/teamStore.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

type SubagentProfile = "explore" | "verify" | "coordinator-worker";
type SubagentBackend = "in-process" | "process" | "tmux";

function inferSubagentProfile(
  profile: unknown,
  subagentName: string,
  prompt: string,
): SubagentProfile | undefined {
  if (
    profile === "explore" ||
    profile === "verify" ||
    profile === "coordinator-worker"
  ) {
    return profile;
  }

  const haystack = `${subagentName} ${prompt}`.toLowerCase();
  if (
    /(verify|verification|review|audit|validate|regression|test)/.test(haystack)
  ) {
    return "verify";
  }

  if (
    /(explore|discovery|discover|research|investigate|map codebase)/.test(
      haystack,
    )
  ) {
    return "explore";
  }

  return undefined;
}

export const subagentTool = async (): Promise<Tool> => {
  const modelServiceState = await serviceContainer.get<ModelServiceState>(
    SERVICE_NAMES.MODEL,
  );

  return {
    ...SUBAGENT_TOOL_META,

    description: generateSubagentToolDescription(modelServiceState),

    parameters: {
      ...SUBAGENT_TOOL_META.parameters,
      properties: {
        ...SUBAGENT_TOOL_META.parameters.properties,
        subagent_name: {
          type: "string",
          description: `The type of specialized agent to use for this task. Available agents: ${
            modelServiceState
              ? getSubagentNames(modelServiceState).join(", ")
              : ""
          }`,
        },
      },
    },

    preprocess: async (args: any) => {
      const {
        description,
        subagent_name,
        profile,
        teammate_name,
        team_name,
        backend,
      } = args;

      const agent = getSubagent(modelServiceState, subagent_name);
      if (!agent) {
        throw new Error(
          `Unknown agent type: ${subagent_name}. Available agents: ${getSubagentNames(
            modelServiceState,
          ).join(", ")}`,
        );
      }

      const inferredProfile = inferSubagentProfile(profile, subagent_name, "");

      return {
        args,
        preview: [
          {
            type: "text",
            content: inferredProfile
              ? `Spawning ${agent.model.name}${
                  teammate_name ? ` as ${teammate_name}` : ""
                }${team_name ? ` in team ${team_name}` : ""} (${inferredProfile}) to: ${description}`
              : `Spawning ${agent.model.name}${
                  teammate_name ? ` as ${teammate_name}` : ""
                }${team_name ? ` in team ${team_name}` : ""}${backend ? ` via ${backend}` : ""} to: ${description}`,
          },
        ],
      };
    },

    run: async (args: any, context?: { toolCallId: string }) => {
      const {
        prompt,
        subagent_name,
        profile,
        description,
        teammate_name,
        team_name,
        backend,
      } = args;

      logger.debug("subagent args", { args, context });

      // get agent configuration
      const agent = getSubagent(modelServiceState, subagent_name);
      if (!agent) {
        throw new Error(`Unknown agent type: ${subagent_name}`);
      }

      const chatHistoryService = services.chatHistory;
      const parentSessionId = chatHistoryService.getSessionId();
      if (!parentSessionId) {
        throw new Error("No active session found");
      }

      const inferredProfile = inferSubagentProfile(
        profile,
        subagent_name,
        prompt,
      );
      const resolvedBackend: SubagentBackend =
        backend === "process" || backend === "tmux" ? backend : "in-process";

      const activeTeam = await getActiveTeam();
      const resolvedTeamName =
        typeof team_name === "string" && team_name.trim().length > 0
          ? team_name.trim()
          : activeTeam?.teamName;

      if (resolvedTeamName && activeTeam?.teamName !== resolvedTeamName) {
        throw new Error(
          `Active team is ${activeTeam?.teamName ?? "unset"}; cannot delegate to ${resolvedTeamName}.`,
        );
      }

      const resolvedTeammateName =
        typeof teammate_name === "string" && teammate_name.trim().length > 0
          ? teammate_name.trim()
          : resolvedTeamName
            ? subagent_name
            : undefined;

      if (resolvedTeamName && resolvedTeammateName) {
        await startTeamMemberRun({
          teamName: resolvedTeamName,
          teammateName: resolvedTeammateName,
          subagentName: subagent_name,
          description,
          prompt,
        });
      }

      if (
        resolvedBackend !== "in-process" &&
        resolvedTeamName &&
        resolvedTeammateName
      ) {
        const currentPermissionMode =
          services.toolPermissions?.getState().currentMode ?? "auto";

        const spawnResult = await spawnSwarmTeammate({
          prompt,
          workerConfig: {
            agentId: `${resolvedTeammateName}@${resolvedTeamName.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
            agentName: resolvedTeammateName,
            teamName: resolvedTeamName,
            parentSessionId,
            backend: resolvedBackend,
            profile: inferredProfile,
            permissionMode: currentPermissionMode,
            model: agent.model?.name,
            agentType: subagent_name,
            agentSystemPrompt: agent.model?.chatOptions?.baseSystemMessage,
            description,
            planModeRequired: currentPermissionMode === "plan",
            options: {
              betaSubagentTool: true,
            },
          },
        });

        return [
          spawnResult.summary,
          "<task_metadata>",
          `status: ${spawnResult.status}`,
          `backend: ${spawnResult.backend}`,
          spawnResult.jobId ? `job_id: ${spawnResult.jobId}` : undefined,
          spawnResult.paneId ? `pane_id: ${spawnResult.paneId}` : undefined,
          "</task_metadata>",
        ]
          .filter(Boolean)
          .join("\n");
      }

      try {
        // Execute subagent with output streaming
        const result = await executeSubAgent({
          agent,
          prompt,
          profile: inferredProfile,
          parentSessionId,
          abortController: new AbortController(),
          onOutputUpdate: context?.toolCallId
            ? (output: string) => {
                try {
                  chatHistoryService.addToolResult(
                    context.toolCallId,
                    output,
                    "calling",
                  );
                } catch {
                  // Ignore errors during streaming updates
                }
              }
            : undefined,
        });

        logger.debug("subagent result", { result });

        const primaryOutput = result.response || result.error || "";
        const status =
          result.status ?? (result.success ? "completed" : "failed");

        if (
          resolvedTeamName &&
          resolvedTeammateName &&
          (status === "completed" ||
            status === "failed" ||
            status === "cancelled")
        ) {
          await finishTeamMemberRun({
            teamName: resolvedTeamName,
            teammateName: resolvedTeammateName,
            status,
            result: primaryOutput,
          });
          await fireTeammateIdle(resolvedTeammateName, resolvedTeamName);
        }

        const output = [
          primaryOutput,
          "<task_metadata>",
          `status: ${status}`,
          "</task_metadata>",
        ]
          .filter(Boolean)
          .join("\n");

        return output;
      } catch (error) {
        if (resolvedTeamName && resolvedTeammateName) {
          const message =
            error instanceof Error ? error.message : String(error);
          await finishTeamMemberRun({
            teamName: resolvedTeamName,
            teammateName: resolvedTeammateName,
            status: "failed",
            result: message,
          });
          await fireTeammateIdle(resolvedTeammateName, resolvedTeamName);
        }

        throw error;
      }
    },
  };
};
