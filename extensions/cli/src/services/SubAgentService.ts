import type { ChatHistoryItem } from "core";

import { streamChatResponse } from "../stream/streamChatResponse.js";
import { escapeEvents } from "../util/cli.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import type { ToolPermissionServiceState } from "./ToolPermissionService.js";
import { type ModelServiceState, SERVICE_NAMES } from "./types.js";

/** Types */

export interface SubAgentExecutionOptions {
  agent: ModelServiceState;
  prompt: string;
  parentSessionId: string;
  abortController: AbortController;
  onOutputUpdate?: (output: string) => void;
}

export interface SubAgentResult {
  success: boolean;
  response: string;
  error?: string;
}

export interface PendingExecution {
  agentName: string;
  startTime: number;
}

export interface SubAgentServiceState {
  isInsideSubagent: boolean;
  currentExecution: PendingExecution | null;
}

/** Service */

export class SubAgentService extends BaseService<SubAgentServiceState> {
  constructor() {
    super("SubAgentService", {
      isInsideSubagent: false,
      currentExecution: null,
    });
  }

  async doInitialize(): Promise<SubAgentServiceState> {
    return {
      isInsideSubagent: false,
      currentExecution: null,
    };
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
    if (this.currentState.isInsideSubagent) {
      return {
        success: false,
        response: "",
        error: "Nested subagent invocation is not allowed",
      };
    }

    const {
      agent: subAgent,
      prompt,
      abortController,
      onOutputUpdate,
    } = options;

    const mainAgentPermissionsState =
      await serviceContainer.get<ToolPermissionServiceState>(
        SERVICE_NAMES.TOOL_PERMISSIONS,
      );

    this.setState({
      isInsideSubagent: true,
      currentExecution: {
        agentName: subAgent.model?.name || "unknown",
        startTime: Date.now(),
      },
    });

    this.emit("subagentStarted", {
      agentName: subAgent.model?.name,
      prompt,
    });

    try {
      logger.debug("Starting subagent execution", {
        agent: subAgent.model?.name,
      });

      const { model, llmApi } = subAgent;
      if (!model || !llmApi) {
        throw new Error("Model or LLM API not available");
      }

      // allow all tools for now
      // todo: eventually we want to show the same prompt in a dialog whether asking whether that tool call is allowed or not
      serviceContainer.set<ToolPermissionServiceState>(
        SERVICE_NAMES.TOOL_PERMISSIONS,
        {
          ...mainAgentPermissionsState,
          permissions: {
            policies: [{ tool: "*", permission: "allow" }],
          },
        },
      );

      const { services } = await import("./index.js");

      // Build agent system message
      const systemMessage = await this.buildAgentSystemMessage(
        subAgent,
        services,
      );

      // Store original system message function
      const originalGetSystemMessage = services.systemMessage?.getSystemMessage;

      // Store original ChatHistoryService ready state
      const chatHistorySvc = services.chatHistory;
      const originalIsReady =
        chatHistorySvc && typeof chatHistorySvc.isReady === "function"
          ? chatHistorySvc.isReady
          : undefined;

      // Override system message for this execution
      if (services.systemMessage) {
        services.systemMessage.getSystemMessage = async () => systemMessage;
      }

      // Temporarily disable ChatHistoryService to prevent it from interfering with child session
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
        let accumulatedOutput = "";

        // Execute the chat stream with child session
        await streamChatResponse(
          chatHistory,
          model,
          llmApi,
          abortController,
          {
            onContent: (content: string) => {
              accumulatedOutput += content;
              onOutputUpdate?.(accumulatedOutput);
            },
            onToolResult: (result: string) => {
              // todo: skip tool outputs - show tool names and params
              accumulatedOutput += `\n\n${result}`;
              onOutputUpdate?.(accumulatedOutput);
            },
          },
          false, // Not compacting
        );

        // The last message (mostly) contains the important output to be submitted back to the main agent
        const lastMessage = chatHistory.at(-1);
        const response =
          typeof lastMessage?.message?.content === "string"
            ? lastMessage.message.content
            : "";

        logger.debug("Subagent execution completed", {
          agent: model?.name,
          responseLength: response.length,
        });

        this.emit("subagentCompleted", {
          agentName: model?.name,
          success: true,
        });

        return {
          success: true,
          response,
        };
      } finally {
        escapeEvents.removeListener("user-escape", escapeHandler);

        // Restore original system message function
        if (services.systemMessage && originalGetSystemMessage) {
          services.systemMessage.getSystemMessage = originalGetSystemMessage;
        }

        // Restore original ChatHistoryService ready state
        if (chatHistorySvc && originalIsReady) {
          chatHistorySvc.isReady = originalIsReady;
        }

        // Restore original main agent tool permissions
        serviceContainer.set<ToolPermissionServiceState>(
          SERVICE_NAMES.TOOL_PERMISSIONS,
          mainAgentPermissionsState,
        );
      }
    } catch (error: any) {
      logger.error("Subagent execution failed", {
        agent: subAgent.model?.name,
        error: error.message,
      });

      this.emit("subagentFailed", {
        agentName: subAgent.model?.name,
        error: error.message,
      });

      return {
        success: false,
        response: "",
        error: error.message,
      };
    } finally {
      this.setState({
        isInsideSubagent: false,
        currentExecution: null,
      });
    }
  }
}

export const subAgentService = new SubAgentService();
