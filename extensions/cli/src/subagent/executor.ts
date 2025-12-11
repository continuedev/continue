import type { ChatHistoryItem } from "core";

import { services } from "../services/index.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";
import { Tool } from "../tools/types.js";
import { logger } from "../util/logger.js";

import { AgentConfig } from "./types.js";

/**
 * Options for executing a subagent
 */
export interface SubAgentExecutionOptions {
  agent: AgentConfig;
  prompt: string;
  parentSessionId: string;
  abortController: AbortController;
  onOutputUpdate?: (output: string) => void;
}

/**
 * Result from executing a subagent
 */
export interface SubAgentResult {
  success: boolean;
  response: string;
  error?: string;
}

/**
 * Filter tools based on agent configuration
 */
function filterToolsByAgent(allTools: Tool[], agent: AgentConfig): Tool[] {
  return allTools.filter((tool) => {
    const toolName = tool.name;
    // If tool is explicitly disabled in agent config, filter it out
    return agent.tools[toolName] !== false;
  });
}

/**
 * Build system message for the agent
 */
async function buildAgentSystemMessage(agent: AgentConfig): Promise<string> {
  const baseMessage = services.systemMessage
    ? await services.systemMessage.getSystemMessage(
        services.toolPermissions.getState().currentMode,
      )
    : "";

  const agentPrompt = agent.systemPrompt || "";

  // Combine base system message with agent-specific prompt
  if (agentPrompt) {
    return `${baseMessage}\n\n${agentPrompt}`;
  }

  return baseMessage;
}

/**
 * Execute a subagent in a child session
 */
export async function executeSubAgent(
  options: SubAgentExecutionOptions,
): Promise<SubAgentResult> {
  const { agent, prompt, abortController, onOutputUpdate } = options;

  try {
    logger.debug("Starting subagent execution", {
      agent: agent.name,
    });

    // Get model and LLM API from model service
    const modelState = services.model.getState();
    const { model, llmApi } = modelState;

    if (!model || !llmApi) {
      throw new Error("Model or LLM API not available");
    }

    logger.debug("debug1 model and llmapi", { model, llmApi });

    // Get all available tools
    const { getAllAvailableTools } = await import("../tools/index.js");
    const allTools = await getAllAvailableTools(true); // headless mode

    // Filter tools based on agent configuration
    const allowedTools = filterToolsByAgent(allTools, agent);

    logger.debug("debug1 Filtered tools for agent", {
      agent: agent.name,
      toolCount: allowedTools.length,
      tools: allowedTools.map((t) => t.name).filter((t) => t !== "Task"),
    });

    // Build agent system message
    const systemMessage = await buildAgentSystemMessage(agent);

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
        message: {
          role: "user",
          content: prompt,
        },
        contextItems: [],
      },
    ] as ChatHistoryItem[];

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
            if (onOutputUpdate) {
              onOutputUpdate(accumulatedOutput);
            }
          },
          onToolResult: (result: string) => {
            // todo: skip tool outputs - show tool names and params
            accumulatedOutput += `\n\n${result}`;
            if (onOutputUpdate) {
              onOutputUpdate(accumulatedOutput);
            }
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

      logger.debug("debug1 response was", {
        response,
        history: chatHistory,
      });

      logger.debug("Subagent execution completed", {
        agent: agent.name,
        responseLength: response.length,
      });

      return {
        success: true,
        response,
      };
    } finally {
      // Restore original system message function
      if (services.systemMessage && originalGetSystemMessage) {
        services.systemMessage.getSystemMessage = originalGetSystemMessage;
      }

      // Restore original ChatHistoryService ready state
      if (chatHistorySvc && originalIsReady) {
        chatHistorySvc.isReady = originalIsReady;
      }
    }
  } catch (error: any) {
    logger.error("Subagent execution failed", {
      agent: agent.name,
      error: error.message,
    });

    return {
      success: false,
      response: "",
      error: error.message,
    };
  }
}
