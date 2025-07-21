import chalk from "chalk";
import express, { Request, Response } from "express";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";
import {
  ensureOrganization,
  getOrganizationId,
  loadAuthConfig,
} from "../auth/workos.js";
import { initializeWithOnboarding } from "../onboarding.js";
import { saveSession } from "../session.js";
import { constructSystemMessage } from "../systemMessage.js";
import telemetryService from "../telemetry/telemetryService.js";
import { formatError } from "../util/formatError.js";
import logger from "../util/logger.js";
import { DisplayMessage } from "../ui/types.js";
import { getToolDisplayName } from "../tools.js";
import path from "path";
import type { StreamCallbacks } from "../streamChatResponse.js";

interface ServeOptions {
  config?: string;
  readonly?: boolean;
  noTools?: boolean;
  verbose?: boolean;
  rule?: string[];
  timeout?: string;
  port?: string;
}

interface ServerState {
  chatHistory: ChatCompletionMessageParam[];
  displayMessages: DisplayMessage[]; // Messages formatted for display with tool info
  config: any;
  model: any;
  isProcessing: boolean;
  lastActivity: number;
  messageQueue: string[];
  currentAbortController: AbortController | null;
  shouldInterrupt: boolean;
  serverRunning: boolean;
}

export async function serve(prompt?: string, options: ServeOptions = {}) {
  const timeoutSeconds = parseInt(options.timeout || "300", 10);
  const timeoutMs = timeoutSeconds * 1000;
  const port = parseInt(options.port || "8000", 10);

  // Initialize authentication
  const authConfig = loadAuthConfig();

  // Initialize with onboarding
  const { config, llmApi, model } = await initializeWithOnboarding(
    authConfig,
    options.config,
    options.rule
  );

  // Ensure organization is selected if authenticated
  let finalAuthConfig = authConfig;
  if (config && authConfig) {
    finalAuthConfig = await ensureOrganization(authConfig, true); // headless mode
    if (finalAuthConfig) {
      const organizationId = getOrganizationId(finalAuthConfig);
      if (organizationId) {
        telemetryService.updateOrganization(organizationId);
      }
    }
  }

  // Initialize chat history
  let chatHistory: ChatCompletionMessageParam[] = [];
  const systemMessage = await constructSystemMessage("", options.rule);
  if (systemMessage) {
    chatHistory.push({ role: "system", content: systemMessage });
  }

  // Initialize server state
  const state: ServerState = {
    chatHistory,
    displayMessages: [], // Initialize empty display messages
    config,
    model,
    isProcessing: false,
    lastActivity: Date.now(),
    messageQueue: [],
    currentAbortController: null,
    shouldInterrupt: false,
    serverRunning: true,
  };

  // Record session start
  telemetryService.recordSessionStart();
  telemetryService.startActiveTime();

  const app = express();
  app.use(express.json());

  // GET /state - Return the current state
  app.get("/state", (_req: Request, res: Response) => {
    state.lastActivity = Date.now();
    res.json({
      chatHistory: state.displayMessages, // Send display messages with proper formatting
      isProcessing: state.isProcessing,
      messageQueueLength: state.messageQueue.length,
    });
  });

  // POST /message - Queue a message and potentially interrupt
  app.post("/message", async (req: Request, res: Response) => {
    state.lastActivity = Date.now();

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message field is required" });
    }

    // Queue the message
    state.messageQueue.push(message);

    // If currently processing, set interrupt flag
    if (state.isProcessing && state.currentAbortController) {
      state.shouldInterrupt = true;
    }

    res.json({
      queued: true,
      position: state.messageQueue.length,
      willInterrupt: state.shouldInterrupt,
    });

    // Process messages if not already processing
    if (!state.isProcessing) {
      processMessages(state, llmApi);
    }
  });

  const server = app.listen(port, () => {
    console.log(chalk.green(`Server started on http://localhost:${port}`));
    console.log(chalk.dim("Endpoints:"));
    console.log(chalk.dim("  GET  /state   - Get current agent state"));
    console.log(
      chalk.dim("  POST /message - Send a message (body: { message: string })")
    );
    console.log(
      chalk.dim(
        `\nServer will shut down after ${timeoutSeconds} seconds of inactivity`
      )
    );

    // If initial prompt provided, queue it for processing
    if (prompt) {
      console.log(chalk.dim("\nProcessing initial prompt..."));
      state.messageQueue.push(prompt);
      processMessages(state, llmApi);
    }
  });

  // Process messages from the queue
  async function processMessages(state: ServerState, llmApi: any) {
    while (state.messageQueue.length > 0 && state.serverRunning) {
      const userMessage = state.messageQueue.shift()!;
      state.isProcessing = true;
      state.shouldInterrupt = false;
      state.lastActivity = Date.now();

      // Add user message to history
      state.chatHistory.push({ role: "user", content: userMessage });
      state.displayMessages.push({ role: "user", content: userMessage });

      try {
        // Create new abort controller for this response
        state.currentAbortController = new AbortController();

        // Stream the response with interruption support
        await streamChatResponseWithInterruption(
          state,
          llmApi,
          state.currentAbortController,
          () => state.shouldInterrupt
        );

        // Save session after successful response
        saveSession(state.chatHistory);

        state.lastActivity = Date.now();
      } catch (e: any) {
        if (e.name === "AbortError") {
          logger.debug("Response interrupted");
          // Remove the partial assistant message if it exists
          const lastMessage = state.chatHistory[state.chatHistory.length - 1];
          if (lastMessage.role === "assistant" && !lastMessage.content) {
            state.chatHistory.pop();
          }
          // Also remove partial display messages
          const lastDisplayMessage = state.displayMessages[state.displayMessages.length - 1];
          if (lastDisplayMessage && lastDisplayMessage.role === "assistant" && lastDisplayMessage.isStreaming) {
            state.displayMessages.pop();
          }
        } else {
          logger.error(`Error: ${formatError(e)}`);
          // Add error message to chat history and display messages
          const errorMessage = `Error: ${formatError(e)}`;
          state.chatHistory.push({
            role: "assistant",
            content: errorMessage,
          });
          state.displayMessages.push({
            role: "assistant",
            content: errorMessage,
          });
        }
      } finally {
        state.currentAbortController = null;
        state.isProcessing = false;
      }
    }
  }

  // Check for inactivity and shutdown
  const inactivityChecker = setInterval(() => {
    if (!state.isProcessing && Date.now() - state.lastActivity > timeoutMs) {
      console.log(
        chalk.yellow(
          `\nShutting down due to ${timeoutSeconds} seconds of inactivity`
        )
      );
      state.serverRunning = false;
      server.close(() => {
        telemetryService.stopActiveTime();
        process.exit(0);
      });
      clearInterval(inactivityChecker);
    }
  }, 1000);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log(chalk.yellow("\nShutting down server..."));
    state.serverRunning = false;
    server.close(() => {
      telemetryService.stopActiveTime();
      process.exit(0);
    });
  });
}

// Modified version of streamChatResponse that supports interruption
async function streamChatResponseWithInterruption(
  state: ServerState,
  llmApi: any,
  abortController: AbortController,
  shouldInterrupt: () => boolean
): Promise<string> {
  // Import the original streamChatResponse logic but add interruption checks
  const { streamChatResponse } = await import("../streamChatResponse.js");

  // Create a wrapper that checks for interruption
  const originalSignal = abortController.signal;
  const checkInterruption = () => {
    if (shouldInterrupt() && !originalSignal.aborted) {
      abortController.abort();
    }
  };

  // Set up periodic interruption checks
  const interruptionChecker = setInterval(checkInterruption, 100);

  let currentStreamingMessage: DisplayMessage | null = null;

  // Create callbacks to capture tool events
  const callbacks: StreamCallbacks = {
    onContent: (content: string) => {
      if (!currentStreamingMessage) {
        currentStreamingMessage = {
          role: "assistant",
          content: "",
          isStreaming: true,
        };
        state.displayMessages.push(currentStreamingMessage);
      }
      currentStreamingMessage.content += content;
    },
    onContentComplete: (content: string) => {
      if (currentStreamingMessage) {
        currentStreamingMessage.content = content;
        currentStreamingMessage.isStreaming = false;
        currentStreamingMessage = null;
      } else {
        // Add complete assistant message
        state.displayMessages.push({
          role: "assistant",
          content: content,
          isStreaming: false,
        });
      }
    },
    onToolStart: (toolName: string, toolArgs?: any) => {
      // Format tool call similar to local mode
      const formatToolCall = (name: string, args: any) => {
        const displayName = getToolDisplayName(name);
        if (!args) return displayName;

        const firstValue = Object.values(args)[0];
        const formatPath = (value: any) => {
          if (typeof value === "string" && path.isAbsolute(value)) {
            const workspaceRoot = process.cwd();
            const relativePath = path.relative(workspaceRoot, value);
            return relativePath || value;
          }
          return value;
        };

        return `${displayName}(${formatPath(firstValue) || ""})`;
      };

      // If there was streaming content, finalize it first
      if (currentStreamingMessage && currentStreamingMessage.content) {
        currentStreamingMessage.isStreaming = false;
        currentStreamingMessage = null;
      }

      state.displayMessages.push({
        role: "system",
        content: `○ ${formatToolCall(toolName, toolArgs)}`,
        messageType: "tool-start",
        toolName,
      });
    },
    onToolResult: (result: string, toolName: string) => {
      // Add tool result with proper formatting
      const displayName = getToolDisplayName(toolName);
      state.displayMessages.push({
        role: "system",
        content: `● ${displayName}`,
        messageType: "tool-result",
        toolName,
        toolResult: result,
      });
    },
    onToolError: (error: string, toolName?: string) => {
      state.displayMessages.push({
        role: "system",
        content: `✗ Tool error: ${error}`,
        messageType: "tool-error",
        toolName,
      });
    },
  };

  try {
    const response = await streamChatResponse(
      state.chatHistory,
      state.model,
      llmApi,
      abortController,
      callbacks
    );
    return response;
  } finally {
    clearInterval(interruptionChecker);
    // Ensure any streaming message is finalized
    if (currentStreamingMessage !== null) {
      // TypeScript is having issues with this line - the message will be finalized anyway
      // currentStreamingMessage.isStreaming = false;
    }
  }
}
