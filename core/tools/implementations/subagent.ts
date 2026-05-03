import { ContextItem, ToolCall } from "../..";
import { applyToolOverrides } from "../applyToolOverrides";
import { ToolImpl } from ".";

const DEFAULT_SUBAGENT_MAX_TURNS = 25;

function findSubagentModel(
  config: import("../..").ContinueConfig,
  requestedName?: string,
) {
  if (!requestedName) {
    return (
      config.selectedModelByRole.subagent ?? config.modelsByRole.subagent[0] ?? null
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
  result: Awaited<ReturnType<typeof import("../../agent/AgentRunner")["runAgent"]>>,
): ContextItem[] {
  const lastAssistantMessage = [...result.messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" && typeof message.content === "string" && message.content.trim().length > 0,
    );

  const finalResponse =
    lastAssistantMessage && typeof lastAssistantMessage.content === "string"
      ? lastAssistantMessage.content
      : "Subagent completed without a final textual response.";

  return [
    {
      name: "Subagent Result",
      description: `stopReason=${result.stopReason}; turns=${result.totalTurns}`,
      content: `Subagent task: ${prompt}\n\n${finalResponse}`,
    },
  ];
}

export const subagentToolImpl: ToolImpl = async (args, extras) => {
  const prompt = typeof args?.prompt === "string" ? args.prompt.trim() : "";
  const requestedName =
    typeof args?.subagent_name === "string" ? args.subagent_name.trim() : undefined;
  const maxTurns =
    typeof args?.maxTurns === "number" ? args.maxTurns : DEFAULT_SUBAGENT_MAX_TURNS;

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

  const { runAgent } = await import("../../agent/AgentRunner");
  const result = await runAgent({
    prompt,
    llm: subagentModel,
    tools: overriddenTools,
    toolExtras: {
      ...extras,
      llm: subagentModel,
      config: subagentConfig,
    },
    systemMessage:
      subagentModel.baseAgentSystemMessage ??
      subagentModel.baseChatSystemMessage ??
      undefined,
    maxTurns,
    sessionMemory: false,
  });

  return summarizeSubagentResult(prompt, result);
};