import { AsyncLocalStorage } from "node:async_hooks";

import type { ChatHistoryItem } from "core";

import { streamChatResponse } from "../stream/streamChatResponse.js";
import { escapeEvents } from "../util/cli.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import type { ToolPermissionServiceState } from "./ToolPermissionService.js";
import { type ModelServiceState, SERVICE_NAMES } from "./types.js";

/** Service */

export class SubAgentService extends BaseService<SubAgentServiceState> {
  constructor() {
    super("SubAgentService", {
      activeExecutions: new Map(),
    });
  }

  async doInitialize(): Promise<SubAgentServiceState> {
    return {
      activeExecutions: new Map(),
    };
  }

  private generateExecutionId(): string {
    return `subagent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  isInsideSubagent(): boolean {
    return subAgentExecutionContext.getStore() !== undefined;
  }

  private async buildAgentSystemMessage(
    agent: ModelServiceState,
    services: any,
  ): Promise<string> {
    const baseMessage = services.systemMessage
      ? await services.systemMessage.getSystemMessage(
          services.toolPermissions.getState().currentMode,
        )
      : "";

    const agentPrompt = agent.model?.chatOptions?.baseSystemMessage || "";

    if (agentPrompt) {
      return `${baseMessage}\n\n${agentPrompt}`;
    }

    return baseMessage;
  }

  async executeSubAgent(
    options: SubAgentExecutionOptions,
  ): Promise<SubAgentResult> {
    if (this.isInsideSubagent()) {
      return {
        success: false,
        response: "",
        error: "Nested subagent invocation is not allowed",
      };
    }

    const { agent: subAgent, prompt, abortController } = options;
    const executionId = this.generateExecutionId();
    const agentName = subAgent.model?.name || "unknown";

    const mainAgentPermissionsState =
      await serviceContainer.get<ToolPermissionServiceState>(
        SERVICE_NAMES.TOOL_PERMISSIONS,
      );

    const execution: PendingExecution = {
      executionId,
      agentName,
      startTime: Date.now(),
    };

    const activeExecutions = new Map(this.currentState.activeExecutions);
    activeExecutions.set(executionId, execution);
    this.setState({ activeExecutions });

    this.emit("subagentStarted", {
      executionId,
      agentName: subAgent.model?.name,
      prompt,
    });

    try {
      logger.debug("Starting subagent execution", {
        executionId,
        agent: subAgent.model?.name,
      });

      const { model, llmApi } = subAgent;
      if (!model || !llmApi) {
        throw new Error("Model or LLM API not available");
      }

      const { services } = await import("./index.js");

      // Build agent system message
      const systemMessage = await this.buildAgentSystemMessage(
        subAgent,
        services,
      );

      // allow all tools for now
      // todo: eventually we want to show the same prompt in a dialog whether asking whether that tool call is allowed or not
      const subAgentPermissions: ToolPermissionServiceState = {
        ...mainAgentPermissionsState,
        permissions: {
          policies: [{ tool: "*", permission: "allow" }],
        },
      };

      const chatHistorySvc = services.chatHistory;
      const originalIsReady =
        chatHistorySvc && typeof chatHistorySvc.isReady === "function"
          ? chatHistorySvc.isReady
          : undefined;

      if (chatHistorySvc && originalIsReady) {
        chatHistorySvc.isReady = () => false;
      }

      const chatHistory = [
        {
          message: { role: "user", content: prompt },
          contextItems: [],
        },
      ] as ChatHistoryItem[];

      const escapeHandler = () => {
        abortController.abort();
        chatHistory.push({
          message: {
            role: "user",
            content: "Subagent execution was cancelled by the user.",
          },
          contextItems: [],
        });
      };

      escapeEvents.on("user-escape", escapeHandler);

      try {
        const result = await subAgentExecutionContext.run(
          {
            executionId,
            systemMessage,
            permissions: subAgentPermissions,
          },
          async () => {
            await streamChatResponse(
              chatHistory,
              model,
              llmApi,
              abortController,
              {
                onContent: (content: string) => {
                  this.emit("subagentContent", {
                    executionId,
                    agentName: model?.name,
                    content,
                    type: "content",
                  });
                },
                onToolResult: (result: string) => {
                  this.emit("subagentContent", {
                    executionId,
                    agentName: model?.name,
                    content: result,
                    type: "toolResult",
                  });
                },
              },
              false,
            );

            const lastMessage = chatHistory.at(-1);
            const response =
              typeof lastMessage?.message?.content === "string"
                ? lastMessage.message.content
                : "";

            return { success: true as const, response };
          },
        );

        logger.debug("Subagent execution completed", {
          executionId,
          agent: model?.name,
          responseLength: result.response.length,
        });

        this.emit("subagentCompleted", {
          executionId,
          agentName: model?.name,
          success: true,
        });

        return result;
      } finally {
        escapeEvents.removeListener("user-escape", escapeHandler);

        if (chatHistorySvc && originalIsReady) {
          chatHistorySvc.isReady = originalIsReady;
        }
      }
    } catch (error: any) {
      logger.error("Subagent execution failed", {
        executionId,
        agent: subAgent.model?.name,
        error: error.message,
      });

      this.emit("subagentFailed", {
        executionId,
        agentName: subAgent.model?.name,
        error: error.message,
      });

      return {
        success: false,
        response: "",
        error: error.message,
      };
    } finally {
      const updatedExecutions = new Map(this.currentState.activeExecutions);
      updatedExecutions.delete(executionId);
      this.setState({ activeExecutions: updatedExecutions });
    }
  }
}

export const subAgentService = new SubAgentService();

// Subagent execution context

interface ExecutionContext {
  executionId: string;
  systemMessage: string;
  permissions: ToolPermissionServiceState;
}

/* Scopes system messages and tool permissions per subagent execution for enabling parallel execution*/
export const subAgentExecutionContext =
  new AsyncLocalStorage<ExecutionContext>();

// Types

export interface SubAgentExecutionOptions {
  agent: ModelServiceState;
  prompt: string;
  parentSessionId: string;
  abortController: AbortController;
}

export interface SubAgentResult {
  success: boolean;
  response: string;
  error?: string;
}

export interface PendingExecution {
  executionId: string;
  agentName: string;
  startTime: number;
}

export interface SubAgentServiceState {
  activeExecutions: Map<string, PendingExecution>;
}
