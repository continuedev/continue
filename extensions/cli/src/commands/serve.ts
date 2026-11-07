import chalk from "chalk";
import type { ChatHistoryItem } from "core/index.js";
import express, { Request, Response } from "express";

import { ToolPermissionServiceState } from "src/services/ToolPermissionService.js";
import { prependPrompt } from "src/util/promptProcessor.js";

import { runEnvironmentInstallSafe } from "../environment/environmentHandler.js";
import { processCommandFlags } from "../flags/flagProcessor.js";
import { setAgentId } from "../index.js";
import { toolPermissionManager } from "../permissions/permissionManager.js";
import {
  getService,
  initializeServices,
  SERVICE_NAMES,
  services,
} from "../services/index.js";
import {
  AgentFileServiceState,
  ConfigServiceState,
  ModelServiceState,
} from "../services/types.js";
import { createSession, loadOrCreateSessionById } from "../session.js";
import { messageQueue } from "../stream/messageQueue.js";
import { constructSystemMessage } from "../systemMessage.js";
import { telemetryService } from "../telemetry/telemetryService.js";
import { gracefulExit, updateAgentMetadata } from "../util/exit.js";
import { formatError } from "../util/formatError.js";
import { getGitDiffSnapshot } from "../util/git.js";
import { logger } from "../util/logger.js";
import { readStdinSync } from "../util/stdin.js";

import { ExtendedCommandOptions } from "./BaseCommandOptions.js";
import { type ServerState } from "./serve.helpers.js";
import {
  getServeStateSnapshot,
  processMessages,
  registerMessageRoutes,
  type ServeMessageContext,
} from "./serve.messages.js";

interface ServeOptions extends ExtendedCommandOptions {
  timeout?: string;
  port?: string;
  /** Storage identifier for remote sync */
  id?: string;
}

/**
 * Decide whether to enqueue the initial prompt on server startup.
 * We only want to send it when starting a brand-new session; if any non-system
 * messages already exist (e.g., after resume), skip to avoid replaying.
 */
export function shouldQueueInitialPrompt(
  history: ChatHistoryItem[],
  prompt?: string | null,
): boolean {
  if (!prompt) {
    return false;
  }

  // If there are any non-system messages, we already have conversation context
  const hasConversation = history.some(
    (item) => item.message.role !== "system",
  );
  return !hasConversation;
}

export async function serve(prompt?: string, options: ServeOptions = {}) {
  // Set agent ID for error reporting if provided
  setAgentId(options.id);

  // Check if prompt should come from stdin instead of parameter
  let actualPrompt = prompt;
  if (!prompt) {
    // Try to read from stdin (for piped input like: cat file | cn serve)
    const stdinInput = readStdinSync();
    if (stdinInput) {
      actualPrompt = stdinInput;
    }
  }

  const timeoutSeconds = parseInt(options.timeout || "300", 10);
  const timeoutMs = timeoutSeconds * 1000;
  const port = parseInt(options.port || "8000", 10);

  // Environment install script will be deferred until after server startup to avoid blocking

  // Initialize services with tool permission overrides
  const { permissionOverrides } = processCommandFlags(options);

  await initializeServices({
    options,
    toolPermissionOverrides: permissionOverrides,
    headless: true, // Skip onboarding in serve mode
  });

  // Get initialized services from the service container
  const [configState, modelState, permissionsState, agentFileState] =
    await Promise.all([
      getService<ConfigServiceState>(SERVICE_NAMES.CONFIG),
      getService<ModelServiceState>(SERVICE_NAMES.MODEL),
      getService<ToolPermissionServiceState>(SERVICE_NAMES.TOOL_PERMISSIONS),
      getService<AgentFileServiceState>(SERVICE_NAMES.AGENT_FILE),
    ]);

  if (!configState.config || !modelState.llmApi || !modelState.model) {
    throw new Error("Failed to initialize required services");
  }

  const { config, llmApi, model } = {
    config: configState.config,
    llmApi: modelState.llmApi,
    model: modelState.model,
  };

  // Log configuration information
  const assistantName = config.name;
  const modelProvider = model.provider;
  const modelName = model.model;

  console.log(chalk.blue(`\nConfiguration:`));
  console.log(chalk.dim(`  Assistant: ${assistantName}`));
  console.log(chalk.dim(`  Model: ${modelProvider}/${modelName}`));
  if (options.config) {
    console.log(chalk.dim(`  Config file: ${options.config}`));
  }

  // Initialize session with system message
  const systemMessage = await constructSystemMessage(
    permissionsState.currentMode,
    options.rule,
    undefined,
    true,
  );

  const initialHistory: ChatHistoryItem[] = [];
  if (systemMessage) {
    initialHistory.push({
      message: { role: "system" as const, content: systemMessage },
      contextItems: [],
    });
  }

  const trimmedId = options.id?.trim();
  const session =
    trimmedId && trimmedId.length > 0
      ? loadOrCreateSessionById(trimmedId, initialHistory)
      : createSession(initialHistory);

  // Align ChatHistoryService with server session and enable remote mode
  try {
    await services.chatHistory.initialize(session, false);
  } catch {
    // Fallback: continue even if service init fails; stream will still work with arrays
  }

  // Initialize server state
  const state: ServerState = {
    session,
    config,
    model,
    isProcessing: false,
    lastActivity: Date.now(),
    currentAbortController: null,
    serverRunning: true,
    pendingPermission: null,
  };

  const syncSessionHistory = () => {
    try {
      state.session.history = services.chatHistory.getHistory();
    } catch (e) {
      logger.debug(
        `Failed to sync session history from ChatHistoryService: ${formatError(e)}`,
      );
    }
  };

  const storageSyncService = services.storageSync;
  let storageSyncActive = await storageSyncService.startFromOptions({
    storageOption: options.id,
    accessToken: null,
    syncSessionHistory,
    getCompleteStateSnapshot: () => getServeStateSnapshot(state),
    isActive: () => state.serverRunning,
  });

  const stopStorageSync = () => {
    if (storageSyncActive) {
      storageSyncService.stop();
      storageSyncActive = false;
    }
  };

  // Record session start
  telemetryService.recordSessionStart();
  telemetryService.startActiveTime();

  const app = express();
  app.use(express.json());

  const messageCtx: ServeMessageContext = {
    state,
    llmApi,
    syncSessionHistory,
    onIdle: () => storageSyncService.markAgentStatusUnread(),
  };
  registerMessageRoutes(app, messageCtx);

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

    // Remove the permission request message if it exists
    // Permission requests are handled separately in unified format

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
      const diffResult = await getGitDiffSnapshot();

      if (!diffResult.repoFound) {
        res.status(404).json({
          error: "Not in a git repository or main branch doesn't exist",
          diff: "",
        });
        return;
      }

      res.json({
        diff: diffResult.diff,
      });
    } catch (error) {
      logger.error(`Git diff error: ${formatError(error)}`);
      res.status(500).json({
        error: `Failed to get git diff: ${formatError(error)}`,
        diff: "",
      });
    }
  });

  // Track intervals for cleanup
  let inactivityChecker: NodeJS.Timeout | null = null;

  // POST /exit - Gracefully shut down the server
  app.post("/exit", async (_req: Request, res: Response) => {
    console.log(
      chalk.yellow("\nReceived exit request, shutting down server..."),
    );

    // Respond immediately before shutting down
    res.json({
      message: "Server shutting down",
      success: true,
    });

    // Set server running flag to false to stop processing
    state.serverRunning = false;
    stopStorageSync();

    // Abort any current processing
    if (state.currentAbortController) {
      state.currentAbortController.abort();
    }

    // Clean up intervals
    if (inactivityChecker) {
      clearInterval(inactivityChecker);
      inactivityChecker = null;
    }

    // Give a moment for the response to be sent
    const handleExitResponse = async () => {
      server.close(async () => {
        telemetryService.stopActiveTime();

        // Update metadata one final time before exiting (with completion flag)
        try {
          const history = services.chatHistory?.getHistory();
          await updateAgentMetadata({ history, isComplete: true });
        } catch (err) {
          logger.debug("Failed to update metadata (non-critical)", err as any);
        }

        gracefulExit(0).catch((err) => {
          logger.error(`Graceful exit failed: ${formatError(err)}`);
          process.exit(1);
        });
      });
    };
    setTimeout(handleExitResponse, 100);
  });

  const server = app.listen(port, async () => {
    console.log(chalk.green(`Server started on http://localhost:${port}`));
    console.log(chalk.dim("Endpoints:"));
    console.log(chalk.dim("  GET  /state      - Get current agent state"));
    console.log(
      chalk.dim(
        "  POST /message    - Send a message (body: { message: string, steer?: boolean })",
      ),
    );
    console.log(
      chalk.dim(
        "  POST /permission - Approve/reject tool (body: { requestId, approved })",
      ),
    );
    console.log(chalk.dim("  POST /pause      - Pause the current agent run"));
    console.log(
      chalk.dim("  GET  /diff       - Get git diff against main branch"),
    );
    console.log(
      chalk.dim("  POST /exit       - Gracefully shut down the server"),
    );
    console.log(
      chalk.dim(
        `\nServer will shut down after ${timeoutSeconds} seconds of inactivity`,
      ),
    );

    // Run environment install script after server startup
    runEnvironmentInstallSafe();

    // If initial prompt provided, queue it for processing
    const initialPrompt = prependPrompt(
      agentFileState?.agentFile?.prompt,
      actualPrompt,
    );

    if (initialPrompt) {
      const existingHistory =
        (() => {
          try {
            return services.chatHistory.getHistory();
          } catch {
            return state.session.history;
          }
        })() ?? [];

      if (shouldQueueInitialPrompt(existingHistory, initialPrompt)) {
        logger.info(chalk.dim("\nProcessing initial prompt..."));
        await messageQueue.enqueueMessage(initialPrompt);
        void processMessages(messageCtx);
      } else {
        logger.info(
          chalk.dim(
            "Skipping initial prompt because existing conversation history was found.",
          ),
        );
      }
    }
  });

  // Check for inactivity and shutdown
  inactivityChecker = setInterval(() => {
    if (!state.isProcessing && Date.now() - state.lastActivity > timeoutMs) {
      console.log(
        chalk.yellow(
          `\nShutting down due to ${timeoutSeconds} seconds of inactivity`,
        ),
      );
      state.serverRunning = false;
      stopStorageSync();
      server.close(async () => {
        telemetryService.stopActiveTime();

        // Update metadata one final time before exiting (with completion flag)
        try {
          const history = services.chatHistory?.getHistory();
          await updateAgentMetadata({ history, isComplete: true });
        } catch (err) {
          logger.debug("Failed to update metadata (non-critical)", err as any);
        }

        gracefulExit(0).catch((err) => {
          logger.error(`Graceful exit failed: ${formatError(err)}`);
          process.exit(1);
        });
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
    stopStorageSync();
    if (inactivityChecker) {
      clearInterval(inactivityChecker);
      inactivityChecker = null;
    }
    server.close(async () => {
      telemetryService.stopActiveTime();

      // Update metadata one final time before exiting (with completion flag)
      try {
        const history = services.chatHistory?.getHistory();
        await updateAgentMetadata({ history, isComplete: true });
      } catch (err) {
        logger.debug("Failed to update metadata (non-critical)", err as any);
      }

      gracefulExit(0).catch((err) => {
        logger.error(`Graceful exit failed: ${formatError(err)}`);
        process.exit(1);
      });
    });
  });
}
