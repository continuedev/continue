import type { Express, Request, Response } from "express";

import {
  describePromptBlocked,
  runUserPromptSubmitHooks,
} from "../hooks/promptHook.js";
import { services } from "../services/index.js";
import { getCompleteStateSnapshot, type StateSnapshot } from "../session.js";
import {
  isQueuedCommand,
  mergeQueuedMessages,
  MessageQueue,
  messageQueue,
} from "../stream/messageQueue.js";
import { reportFailureTool } from "../tools/reportFailure.js";
import { updateAgentMetadata } from "../util/exit.js";
import { formatError } from "../util/formatError.js";
import { logger } from "../util/logger.js";

import {
  checkAgentComplete,
  removePartialAssistantMessage,
  streamChatResponseWithInterruption,
  type ServerState,
} from "./serve.helpers.js";

/** One queued message as `GET /state` reports it. */
export interface QueuedMessageSnapshot {
  id: string;
  message: string;
  timestamp: number;
  /** Goes at the next tool boundary of the running turn, not at its end. */
  steer: boolean;
}

/** The queue fields `GET /state` adds next to `messageQueueLength`. */
export interface QueueSnapshot {
  messageQueue: QueuedMessageSnapshot[];
  /** Set by `POST /pause`; nothing queued is sent until the next message. */
  messageQueuePaused: boolean;
  steerRequested: boolean;
}

export function getQueueSnapshot(
  queue: MessageQueue = messageQueue,
): QueueSnapshot {
  const steerRequested = queue.isSteerRequested();
  return {
    messageQueue: queue.list().map((item) => ({
      id: item.id,
      message: item.message,
      timestamp: item.timestamp,
      // Steering takes every queued plain message; commands wait for the end
      // of the turn (see MessageQueue.takeSteerMessages).
      steer: steerRequested && !isQueuedCommand(item.message),
    })),
    messageQueuePaused: queue.isPaused(),
    steerRequested,
  };
}

export interface ServeMessageContext {
  state: ServerState;
  llmApi: any;
  syncSessionHistory: () => void;
  /** Called when a run of turns has ended with nothing left in the queue. */
  onIdle: () => Promise<void>;
}

export function getServeStateSnapshot(
  state: ServerState,
): StateSnapshot & QueueSnapshot {
  return {
    ...getCompleteStateSnapshot(
      state.session,
      state.isProcessing,
      messageQueue.getQueueLength(),
      state.pendingPermission,
    ),
    ...getQueueSnapshot(),
  };
}

/** GET /state, POST /message and POST /pause. */
export function registerMessageRoutes(
  app: Express,
  ctx: ServeMessageContext,
): void {
  const { state } = ctx;

  // GET /state - Return the current state
  app.get("/state", (_req: Request, res: Response) => {
    state.lastActivity = Date.now();
    ctx.syncSessionHistory();
    res.json(getServeStateSnapshot(state));
  });

  // POST /message - Queue a message; `steer: true` delivers it in this turn
  app.post("/message", async (req: Request, res: Response) => {
    state.lastActivity = Date.now();

    const { message, steer } = req.body ?? {};
    if (!message) {
      return res.status(400).json({ error: "Message field is required" });
    }
    if (steer !== undefined && typeof steer !== "boolean") {
      return res.status(400).json({ error: "steer must be a boolean" });
    }

    // Queue the message. A message sent after /pause resumes the queue and
    // goes out together with whatever was queued before the pause.
    await messageQueue.enqueueMessage(message);
    messageQueue.resume();

    // Steering only means something while a run is in progress: the queued
    // plain messages go at its next tool boundary. If the run ends without
    // one, they go at the end of the turn as any queued message does.
    const steered =
      steer === true &&
      state.isProcessing &&
      !isQueuedCommand(message) &&
      messageQueue.requestSteer();

    res.json({
      queued: true,
      position: messageQueue.getQueueLength(),
      steered,
    });

    // Process messages if not already processing
    if (!state.isProcessing) {
      void processMessages(ctx);
    }
  });

  // POST /pause - Pause the current agent run (like pressing escape in TUI)
  app.post("/pause", async (_req: Request, res: Response) => {
    state.lastActivity = Date.now();

    // Check if there's anything to pause
    if (!state.isProcessing) {
      return res.json({
        success: false,
        message: "No active processing to pause",
      });
    }

    // Keep the queue but do not send it until the next message arrives, as
    // Esc does in the TUI
    messageQueue.pause();

    // Abort the current processing
    if (state.currentAbortController) {
      state.currentAbortController.abort();
    }

    // Set isProcessing to false
    state.isProcessing = false;

    res.json({
      success: true,
      message: "Agent run paused",
    });
  });
}

async function reportTurnError(state: ServerState, e: unknown) {
  logger.error(`Error: ${formatError(e)}`);

  // Add error message via ChatHistoryService
  const errorMessage = `Error: ${formatError(e)}`;
  try {
    services.chatHistory.addAssistantMessage(errorMessage);
  } catch {
    state.session.history.push({
      message: { role: "assistant", content: errorMessage },
      contextItems: [],
    });
  }

  // Report failure to control plane (retries exhausted or non-retryable error)
  try {
    await reportFailureTool.run({
      errorMessage: formatError(e),
    });
  } catch (reportError) {
    logger.error(`Failed to report agent failure: ${formatError(reportError)}`);
    // Don't block on reporting failure
  }
}

async function runTurn(ctx: ServeMessageContext, prompt: string) {
  const { state } = ctx;

  // Add user message via ChatHistoryService (single source of truth)
  try {
    services.chatHistory.addUserMessage(prompt);
  } catch {
    // Fallback to local array if service unavailable
    state.session.history.push({
      message: { role: "user", content: prompt },
      contextItems: [],
    });
  }

  try {
    // Create new abort controller for this response
    state.currentAbortController = new AbortController();

    // Stream the response with interruption support
    await streamChatResponseWithInterruption(
      state,
      ctx.llmApi,
      state.currentAbortController,
      () => false,
    );

    // No direct persistence here; ChatHistoryService handles persistence when appropriate

    state.lastActivity = Date.now();

    // Update metadata after successful agent turn
    try {
      const history = services.chatHistory?.getHistory();
      await updateAgentMetadata({
        history,
        isComplete: checkAgentComplete(history),
      });
    } catch (metadataErr) {
      logger.debug(
        "Failed to update metadata after turn (non-critical)",
        metadataErr as any,
      );
    }
  } catch (e: any) {
    if (e.name === "AbortError") {
      logger.debug("Response interrupted");
      removePartialAssistantMessage(state.session.history);
    } else {
      await reportTurnError(state, e);
    }
  } finally {
    state.currentAbortController = null;
    state.isProcessing = false;
  }
}

/** Send what is queued, one turn at a time, until the queue is empty. */
export async function processMessages(ctx: ServeMessageContext) {
  const { state } = ctx;
  let processedMessage = false;
  while (state.serverRunning) {
    // Everything queued while the last turn ran goes as one message;
    // nothing goes while paused.
    const queuedMessage = mergeQueuedMessages(messageQueue.takeNextBatch());
    if (!queuedMessage) {
      break;
    }

    const userMessage = queuedMessage.message;
    state.isProcessing = true;
    state.lastActivity = Date.now();
    processedMessage = true;

    // UserPromptSubmit hooks can stop the message or add context. A
    // stopped message is answered in the conversation, so whoever is
    // watching the session sees why nothing happened.
    const promptHook = await runUserPromptSubmitHooks(userMessage);
    if (promptHook.blockedReason) {
      try {
        services.chatHistory.addAssistantMessage(
          describePromptBlocked(promptHook.blockedReason),
        );
      } catch {
        logger.warn(`A hook blocked a message: ${promptHook.blockedReason}`);
      }
      state.isProcessing = false;
      continue;
    }

    await runTurn(ctx, promptHook.prompt);
  }

  if (
    processedMessage &&
    state.serverRunning &&
    messageQueue.getQueueLength() === 0
  ) {
    await ctx.onIdle();
  }
}
