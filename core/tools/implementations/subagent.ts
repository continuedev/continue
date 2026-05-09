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
  const profile = getSubagentProfile(args);
  const parentSessionId = (extras as any)._agentSessionId as string | undefined;

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
        ...extras,
        llm: subagentModel,
        config: subagentConfig,
      },
      systemMessage,
      maxTurns,
      sessionMemory: false,
    });

    const summary = summarizeSubagentResult(prompt, result);

    if (scratchpadPath && parentSessionId) {
      await appendWorkerScratchpadEntry(scratchpadPath, parentSessionId, {
        agentName: subagentModel.title || subagentModel.model,
        prompt,
        response: summary[0]?.content ?? "Subagent completed.",
        status: result.stopReason === "aborted" ? "cancelled" : "completed",
        profile,
      });
    }

    return summary;
  } catch (error) {
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
