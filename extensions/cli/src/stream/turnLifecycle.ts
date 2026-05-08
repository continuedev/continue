import { ModelConfig } from "@yutoagentic/config-yaml";
import { BaseLlmApi } from "@yutoagentic/openai-adapters";
import type {
  TurnLifecycleContext,
  TurnLifecycleHandler,
} from "core/agent/contracts/index.js";
import type { ChatHistoryItem } from "core/index.js";

import { fireStop, fireTaskCompleted } from "../hooks/fireHook.js";
import type { TaskRecord } from "../services/TaskStateService.js";
import { services } from "../services/index.js";
import { getCurrentSession } from "../session.js";
import type { ToolCall } from "../tools/index.js";

function getSessionId(): string {
  try {
    return getCurrentSession().sessionId;
  } catch {
    return "";
  }
}

function getTurnEndHandlers(args: {
  llmApi: BaseLlmApi;
  model: ModelConfig;
  lastAssistantMessage: string;
  wasAborted: boolean;
  task: TaskRecord | null;
}): TurnLifecycleHandler<ChatHistoryItem>[] {
  const { llmApi, model, lastAssistantMessage, wasAborted, task } = args;

  return [
    async (context) => {
      try {
        const systemMessage = await services.systemMessage.getSystemMessage(
          services.toolPermissions.getState().currentMode,
        );
        services.contextAnalysis.update(context.messages, model, systemMessage);
      } catch {}
    },
    async () => {
      try {
        if (wasAborted) {
          services.taskState.killTask();
        } else {
          services.taskState.completeTask();
        }
      } catch {}
    },
    async () => {
      if (!services.featureFlags.isEnabled("TURN_LIFECYCLE_HOOKS")) {
        return;
      }

      await fireStop(lastAssistantMessage || undefined);

      if (!wasAborted && task) {
        await fireTaskCompleted(task.id, task.description, task.description);
      }

      return {
        metadata: {
          stopHookFired: true,
          taskCompletedHookFired: !wasAborted && !!task,
        },
      };
    },
    async () => {
      try {
        services.autoDream.schedule(llmApi, model);
      } catch {}
    },
  ];
}

export async function runAfterToolBatchLifecycle(args: {
  chatHistory: ChatHistoryItem[];
  llmApi: BaseLlmApi;
  model: ModelConfig;
  toolCalls: ToolCall[];
}): Promise<void> {
  const { chatHistory, llmApi, model, toolCalls } = args;

  if (toolCalls.length === 0) {
    return;
  }

  const context: TurnLifecycleContext<ChatHistoryItem> = {
    phase: "after-tool-batch",
    sessionId: getSessionId(),
    messages: chatHistory,
    metrics: {
      turn: services.taskState.getState().sessionTaskCount,
      toolCallCount: toolCalls.length,
      inputTokens: services.taskState.getCurrentTask()?.tokensUsed,
    },
  };

  await services.hooks.runTurnLifecycle(context, [
    async () => {
      try {
        services.sessionMemory.recordToolCalls(toolCalls.length);
        services.sessionMemory.maybeExtract(chatHistory, llmApi, model);
      } catch {}
    },
    async () => {
      try {
        services.progressTracker.recordToolCalls(
          toolCalls.map((toolCall) => ({
            name: toolCall.name,
            arguments: toolCall.argumentsStr,
          })),
        );
        for (let index = 0; index < toolCalls.length; index++) {
          services.taskState.recordToolCall();
        }
      } catch {}
    },
  ]);
}

export async function runTurnEndLifecycle(args: {
  chatHistory: ChatHistoryItem[];
  llmApi: BaseLlmApi;
  model: ModelConfig;
  lastAssistantMessage: string;
  wasAborted: boolean;
}): Promise<void> {
  const task = services.taskState.getCurrentTask();

  const context: TurnLifecycleContext<ChatHistoryItem> = {
    phase: "turn-end",
    sessionId: getSessionId(),
    messages: args.chatHistory,
    metrics: {
      turn: services.taskState.getState().sessionTaskCount,
      toolCallCount: task?.toolCallCount,
      inputTokens: task?.tokensUsed,
    },
    metadata: {
      taskId: task?.id,
      taskStatus: args.wasAborted ? "killed" : "completed",
    },
  };

  await services.hooks.runTurnLifecycle(
    context,
    getTurnEndHandlers({
      llmApi: args.llmApi,
      model: args.model,
      lastAssistantMessage: args.lastAssistantMessage,
      wasAborted: args.wasAborted,
      task,
    }),
  );
}
