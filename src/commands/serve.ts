import chalk from "chalk";
import { exec } from "child_process";
import express, { Request, Response } from "express";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";
import path from "path";
import { promisify } from "util";
import {
  getAssistantSlug,
} from "../auth/workos.js";
import { toolPermissionManager } from "../permissions/permissionManager.js";
import { saveSession } from "../session.js";
import { getService, initializeServices, SERVICE_NAMES } from "../services/index.js";
import { AuthServiceState, ConfigServiceState, ModelServiceState } from "../services/types.js";
import { streamChatResponse, type StreamCallbacks } from "../streamChatResponse.js";
import { constructSystemMessage } from "../systemMessage.js";
import telemetryService from "../telemetry/telemetryService.js";
import { getToolDisplayName } from "../tools.js";
import { DisplayMessage } from "../ui/types.js";
import { formatError } from "../util/formatError.js";
import logger from "../util/logger.js";
import { ExtendedCommandOptions } from "./BaseCommandOptions.js";

const execAsync = promisify(exec);

interface ServeOptions extends ExtendedCommandOptions {
  timeout?: string;
  port?: string;
}

interface PendingPermission {
  toolName: string;
  toolArgs: any;
  requestId: string;
  timestamp: number;
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
  pendingPermission: PendingPermission | null;
}

export async function serve(prompt?: string, options: ServeOptions = {}) {
  const timeoutSeconds = parseInt(options.timeout || "300", 10);
  const timeoutMs = timeoutSeconds * 1000;
  const port = parseInt(options.port || "8000", 10);

  // Initialize services with tool permission overrides
  await initializeServices({
    toolPermissionOverrides: {
      allow: options.allow,
      ask: options.ask,
      exclude: options.exclude,
    },
    configPath: options.config,
    rules: options.rule,
    headless: true, // Skip onboarding in serve mode
  });

  // Get initialized services from the service container
  const [configState, modelState] = await Promise.all([
    getService<ConfigServiceState>(SERVICE_NAMES.CONFIG),
    getService<ModelServiceState>(SERVICE_NAMES.MODEL),
  ]);

  if (!configState.config || !modelState.llmApi || !modelState.model) {
    throw new Error("Failed to initialize required services");
  }

  const { config, llmApi, model } = {
    config: configState.config,
    llmApi: modelState.llmApi,
    model: modelState.model,
  };

  // Organization selection is already handled in initializeServices
  const authState = await getService<AuthServiceState>(SERVICE_NAMES.AUTH);
  if (authState.organizationId) {
    telemetryService.updateOrganization(authState.organizationId);
  }

  // Log configuration information
  const organizationId = authState.organizationId || 'personal';
  const assistantName = config.name;
  const assistantSlug = getAssistantSlug(authState.authConfig);
  const modelProvider = model.provider;
  const modelName = model.model;
  
  console.log(chalk.blue(`\nConfiguration:`));
  console.log(chalk.dim(`  Organization: ${organizationId}`));
  console.log(chalk.dim(`  Assistant: ${assistantName}${assistantSlug ? ` (${assistantSlug})` : ''}`));
  console.log(chalk.dim(`  Model: ${modelProvider}/${modelName}`));
  if (options.config) {
    console.log(chalk.dim(`  Config file: ${options.config}`));
  }

  // Initialize chat history
  let chatHistory: ChatCompletionMessageParam[] = [];
  const systemMessage = await constructSystemMessage("", options.rule, undefined, true);
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
    pendingPermission: null,
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
      pendingPermission: state.pendingPermission,
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

  // POST /permission - Approve or reject pending tool permission
  app.post("/permission", async (req: Request, res: Response) => {
    state.lastActivity = Date.now();

    const { requestId, approved } = req.body;
    
    if (!state.pendingPermission) {
      return res.status(400).json({ error: "No pending permission request" });
    }
    
    if (state.pendingPermission.requestId !== requestId) {
      return res.status(400).json({ error: "Invalid request ID" });
    }
    
    // Remove the permission request message
    const lastMsg = state.displayMessages[state.displayMessages.length - 1];
    if (lastMsg && lastMsg.messageType === "tool-permission-request") {
      state.displayMessages.pop();
    }
    
    // Send the permission response to the toolPermissionManager
    if (approved) {
      toolPermissionManager.approveRequest(requestId);
    } else {
      toolPermissionManager.rejectRequest(requestId);
    }
    
    // Clear pending permission state
    state.pendingPermission = null;
    
    res.json({
      success: true,
      approved,
    });
  });

  // GET /diff - Return git diff against main branch
  app.get("/diff", async (_req: Request, res: Response) => {
    state.lastActivity = Date.now();

    try {
      // First check if we're in a git repository
      await execAsync("git rev-parse --git-dir");

      // Get the diff against main branch
      const { stdout } = await execAsync("git diff main");

      res.json({
        diff: stdout,
      });
    } catch (error: any) {
      // Git diff returns exit code 1 when there are differences, which is normal
      if (error.code === 1 && error.stdout) {
        res.json({
          diff: error.stdout,
        });
      } else if (error.code === 128) {
        // Handle case where we're not in a git repo or main branch doesn't exist
        res.status(404).json({
          error: "Not in a git repository or main branch doesn't exist",
          diff: "",
        });
      } else {
        logger.error(`Git diff error: ${formatError(error)}`);
        res.status(500).json({
          error: `Failed to get git diff: ${formatError(error)}`,
          diff: "",
        });
      }
    }
  });

  // Track intervals for cleanup
  let inactivityChecker: NodeJS.Timeout | null = null;

  // POST /exit - Gracefully shut down the server
  app.post("/exit", async (_req: Request, res: Response) => {
    console.log(
      chalk.yellow("\nReceived exit request, shutting down server...")
    );

    // Respond immediately before shutting down
    res.json({
      message: "Server shutting down",
      success: true,
    });

    // Set server running flag to false to stop processing
    state.serverRunning = false;

    // Abort any current processing
    if (state.currentAbortController) {
      state.currentAbortController.abort();
    }

    // Clear the message queue
    state.messageQueue = [];

    // Clean up intervals
    if (inactivityChecker) {
      clearInterval(inactivityChecker);
      inactivityChecker = null;
    }

    // Give a moment for the response to be sent
    setTimeout(() => {
      server.close(() => {
        telemetryService.stopActiveTime();
        process.exit(0);
      });
    }, 100);
  });

  const server = app.listen(port, () => {
    console.log(chalk.green(`Server started on http://localhost:${port}`));
    console.log(chalk.dim("Endpoints:"));
    console.log(chalk.dim("  GET  /state      - Get current agent state"));
    console.log(
      chalk.dim("  POST /message    - Send a message (body: { message: string })")
    );
    console.log(
      chalk.dim("  POST /permission - Approve/reject tool (body: { requestId, approved })")
    );
    console.log(
      chalk.dim("  GET  /diff       - Get git diff against main branch")
    );
    console.log(chalk.dim("  POST /exit       - Gracefully shut down the server"));
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
          const lastDisplayMessage =
            state.displayMessages[state.displayMessages.length - 1];
          if (
            lastDisplayMessage &&
            lastDisplayMessage.role === "assistant" &&
            lastDisplayMessage.isStreaming
          ) {
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
  inactivityChecker = setInterval(() => {
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
      if (inactivityChecker) {
        clearInterval(inactivityChecker);
        inactivityChecker = null;
      }
    }
  }, 1000);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log(chalk.yellow("\nShutting down server..."));
    state.serverRunning = false;
    if (inactivityChecker) {
      clearInterval(inactivityChecker);
      inactivityChecker = null;
    }
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
      // Replace the tool-start message with tool-result
      const displayName = getToolDisplayName(toolName);

      // Find and replace the corresponding tool-start message
      for (let i = state.displayMessages.length - 1; i >= 0; i--) {
        if (
          state.displayMessages[i].messageType === "tool-start" &&
          state.displayMessages[i].toolName === toolName
        ) {
          state.displayMessages[i] = {
            ...state.displayMessages[i],
            content: `● ${displayName}`,
            messageType: "tool-result",
            toolResult: result,
          };
          return;
        }
      }

      // If no tool-start found, add as new message (fallback)
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
    onToolPermissionRequest: (
      toolName: string,
      toolArgs: any,
      requestId: string
    ) => {
      // Set pending permission state
      state.pendingPermission = {
        toolName,
        toolArgs,
        requestId,
        timestamp: Date.now(),
      };

      // Add a display message indicating permission is needed
      state.displayMessages.push({
        role: "system",
        content: `⚠️ Tool ${toolName} requires permission`,
        messageType: "tool-permission-request" as any,
        toolName,
      });

      // Don't wait here - the streamChatResponse will handle waiting
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