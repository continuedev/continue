import chalk from "chalk";
import type { Express, Request, Response } from "express";

import {
  describePromptBlocked,
  runUserPromptSubmitHooks,
} from "../hooks/promptHook.js";
import { runLoopCheck } from "../loop/loopChecks.js";
import { loopWakeDelay, nextLoopTurn } from "../loop/loopDriver.js";
import { prepareLoopTurn } from "../loop/loopSession.js";
import { getSessionLoop, interruptRunningLoop } from "../loop/loopSession.js";
import { services } from "../services/index.js";
import { getCompleteStateSnapshot, type StateSnapshot } from "../session.js";
import {
  isQueuedCommand,
  mergeQueuedMessages,
  MessageQueue,
  messageQueue,
} from "../stream/messageQueue.js";
import { reportFailureTool } from "../tools/reportFailure.js";
import {
  cacheTallySnapshot,
  type CacheTallySnapshot,
  describeCacheTally,
} from "../util/cacheTally.js";
import { updateAgentMetadata } from "../util/exit.js";
import { formatError } from "../util/formatError.js";
import { logger } from "../util/logger.js";
import {
  answerPendingQuestion,
  listPendingQuestions,
  openPendingQuestions,
  pendingAnswerMessage,
  type PendingQuestion,
  pendingQuestionState,
} from "../util/pendingQuestions.js";
import { formatReplyTally, getTruncatedReplies } from "../util/replyTally.js";

import {
  checkAgentComplete,
  removePartialAssistantMessage,
  streamChatResponseWithInterruption,
  type ServerState,
} from "./serve.helpers.js";
import {
  getLoopSnapshot,
  handleLoopMessage,
  LoopSnapshot,
} from "./serve.loop.js";

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
  /** processMessages is sending turns; another call only asks it to look again */
  draining?: boolean;
  lookAgain?: boolean;
  /** Wakes an unattended loop when its wait for answers runs out */
  loopWakeTimer?: ReturnType<typeof setTimeout>;
}

/** What this process's requests did, next to the session's cumulative usage. */
export interface RunTallySnapshot {
  /**
   * The prompt cache, counted per request of this process: requests, input
   * tokens processed, tokens read and written, and how many requests were
   * under the model's minimum cacheable prompt (so could not be cached).
   */
  promptCache: CacheTallySnapshot;
  /** Replies the output limit cut off (finish_reason "length"). */
  truncatedReplies: number;
  /** Questions asked with nobody to answer, answered ones included. */
  pendingQuestions: (PendingQuestion & { state: "open" | "answered" })[];
  /** How many of them still wait for an answer. */
  openQuestions: number;
}

export function getServeStateSnapshot(
  state: ServerState,
): StateSnapshot & QueueSnapshot & LoopSnapshot & RunTallySnapshot {
  return {
    ...getCompleteStateSnapshot(
      state.session,
      state.isProcessing,
      messageQueue.getQueueLength(),
      state.pendingPermission,
    ),
    ...getQueueSnapshot(),
    ...getLoopSnapshot(),
    promptCache: cacheTallySnapshot(),
    truncatedReplies: getTruncatedReplies(),
    // Questions the model asked with nobody to answer (plan turns): answer
    // one with POST /message { answerQuestion: id, answer }
    pendingQuestions: listPendingQuestions().map((q) => ({
      ...q,
      state: pendingQuestionState(q),
    })),
    openQuestions: openPendingQuestions().length,
  };
}

/**
 * An answer to a held question: recorded, and delivered to the model as the
 * next message. 404 when no open question has the id.
 */
export function handlePendingAnswer(body: {
  answerQuestion?: unknown;
  answer?: unknown;
}): { status: number; json: Record<string, unknown> } | undefined {
  if (body.answerQuestion === undefined) return undefined;
  if (
    typeof body.answerQuestion !== "string" ||
    typeof body.answer !== "string"
  ) {
    return {
      status: 400,
      json: { error: "answerQuestion (id) and answer must be strings" },
    };
  }
  const answered = answerPendingQuestion(body.answerQuestion, body.answer);
  if (!answered) {
    return {
      status: 404,
      json: { error: `No open question with id ${body.answerQuestion}` },
    };
  }
  return { status: 200, json: { answered: answered.id } };
}

/** The end-of-turn lines for the serve log: the cache tally, cut-off replies. */
export function logTurnTally(): void {
  const cacheLine = describeCacheTally();
  if (cacheLine) logger.info(chalk.dim(cacheLine));
  const cutOff = formatReplyTally();
  if (cutOff) logger.info(chalk.yellow(cutOff));
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

    // Loop mode: an answer for the inbox, or one of its buttons
    const loopResponse = handleLoopMessage(req.body ?? {});
    if (loopResponse) {
      res.status(loopResponse.status).json(loopResponse.json);
      if (loopResponse.status === 200 && !state.isProcessing) {
        void processMessages(ctx);
      }
      return;
    }

    // An answer to a question held in the inbox: it reaches the model as a
    // message of its own in the next turn
    const answered = handlePendingAnswer(req.body ?? {});
    if (answered) {
      res.status(answered.status).json(answered.json);
      if (answered.status === 200) {
        const held = listPendingQuestions().find(
          (q) => q.id === answered.json.answered,
        );
        if (held) await messageQueue.enqueueMessage(pendingAnswerMessage(held));
        messageQueue.resume();
        if (!state.isProcessing) void processMessages(ctx);
      }
      return;
    }

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
    // A loop step that is stopped stops the loop; its item goes back to pending
    interruptRunningLoop();

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
  // A turn that failed during a loop step stops the loop, as /pause does
  interruptRunningLoop(
    "A turn failed while the loop was running. Resume to go on.",
  );

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
    logTurnTally();

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

function historyLength(state: ServerState): number {
  try {
    return services.chatHistory.getHistory().length;
  } catch {
    return state.session.history.length;
  }
}

/** Unattended: look again when the loop's wait for answers runs out. */
function scheduleLoopWake(ctx: ServeMessageContext): void {
  if (ctx.loopWakeTimer) clearTimeout(ctx.loopWakeTimer);
  ctx.loopWakeTimer = undefined;
  const delay = loopWakeDelay(getSessionLoop());
  if (delay === undefined || !ctx.state.serverRunning) return;
  ctx.loopWakeTimer = setTimeout(() => {
    if (!ctx.state.isProcessing) void processMessages(ctx);
  }, delay);
  ctx.loopWakeTimer.unref?.();
}

/**
 * Send what is queued, one turn at a time, until the queue is empty; then
 * the turns Loop mode asks for (src/loop/loopDriver.ts), the person's queued
 * messages going first after each.
 */
export async function processMessages(ctx: ServeMessageContext) {
  if (ctx.draining) {
    ctx.lookAgain = true;
    return;
  }
  ctx.draining = true;
  try {
    await drainMessages(ctx);
  } finally {
    ctx.draining = false;
    if (ctx.lookAgain) {
      ctx.lookAgain = false;
      if (ctx.state.serverRunning) void processMessages(ctx);
    } else {
      scheduleLoopWake(ctx);
    }
  }
}

async function drainMessages(ctx: ServeMessageContext) {
  const { state } = ctx;
  let processedMessage = false;
  while (state.serverRunning) {
    // Everything queued while the last turn ran goes as one message;
    // nothing goes while paused.
    const queuedMessage = mergeQueuedMessages(messageQueue.takeNextBatch());
    if (!queuedMessage) {
      // Nothing of the person's is waiting: the loop's next step, if any
      const step = nextLoopTurn(historyLength(state));
      if (!step) break;
      state.isProcessing = true;
      state.lastActivity = Date.now();
      processedMessage = true;
      if (step.kind === "check") {
        // An item's check: the harness runs the command, no model turn
        try {
          await runLoopCheck(step);
        } finally {
          state.isProcessing = false;
        }
        continue;
      }
      await prepareLoopTurn(step.kind);
      await runTurn(ctx, step.prompt);
      continue;
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
