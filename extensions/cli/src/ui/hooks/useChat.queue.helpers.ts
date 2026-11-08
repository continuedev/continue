import type { ChatHistoryItem } from "core/index.js";
import { useEffect, useState } from "react";

import {
  describePromptBlocked,
  runUserPromptSubmitHooks,
} from "../../hooks/promptHook.js";
import {
  mergeQueuedMessages,
  MessageQueue,
  QueuedMessage,
} from "../../stream/messageQueue.js";

import { formatMessageWithFiles, trackUserMessage } from "./useChat.helpers.js";

export interface QueueView {
  items: QueuedMessage[];
  paused: boolean;
  steerRequested: boolean;
  /** The queued message highlighted for + / - / Delete / Enter */
  selectedId: string | null;
}

export function readQueueView(queue: MessageQueue): QueueView {
  return {
    items: queue.list(),
    paused: queue.isPaused(),
    steerRequested: queue.isSteerRequested(),
    selectedId: queue.getSelectedId(),
  };
}

/**
 * The queue as React state. It is read from the queue on every change, never
 * edited on its own, so the display cannot drift from what will be sent.
 */
export function useQueueView(queue: MessageQueue): QueueView {
  const [view, setView] = useState<QueueView>(() => readQueueView(queue));
  useEffect(() => {
    const onChanged = () => setView(readQueueView(queue));
    queue.on("changed", onChanged);
    // Pick up anything that changed between the first render and now.
    onChanged();
    return () => {
      queue.off("changed", onChanged);
    };
  }, [queue]);
  return view;
}

/**
 * The tool-boundary callback for the agent loop: when the person asked to
 * steer, take the queued plain messages, run them through the same
 * UserPromptSubmit hooks as a typed message, and return them as one user
 * message to append. Returns undefined when there is nothing to deliver.
 */
export async function buildSteeringMessage(
  queue: MessageQueue,
  options: {
    onShowStatusMessage?: (message: string) => void;
    model?: unknown;
  } = {},
): Promise<ChatHistoryItem | undefined> {
  const merged = mergeQueuedMessages(queue.takeSteerMessages());
  if (!merged) return undefined;

  const promptHook = await runUserPromptSubmitHooks(merged.message);
  if (promptHook.blockedReason) {
    options.onShowStatusMessage?.(
      describePromptBlocked(promptHook.blockedReason),
    );
    return undefined;
  }

  trackUserMessage(promptHook.prompt, options.model);
  return formatMessageWithFiles(promptHook.prompt, [], merged.imageMap);
}
