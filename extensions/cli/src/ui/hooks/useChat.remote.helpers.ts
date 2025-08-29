import type { ChatHistoryItem } from "core/index.js";

import { posthogService } from "../../telemetry/posthogService.js";
import { logger } from "../../util/logger.js";

import { RemoteServerState } from "./useChat.types.js";

/**
 * Poll remote server for state updates
 */
async function pollRemoteServerState(
  remoteUrl: string,
): Promise<RemoteServerState | null> {
  try {
    const response = await fetch(`${remoteUrl}/state`);
    if (!response.ok) {
      throw new Error(`Failed to fetch state: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    logger.error("Failed to poll server state:", error);
    return null;
  }
}

interface SetupRemotePollingOptions {
  remoteUrl: string;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setIsWaitingForResponse: React.Dispatch<React.SetStateAction<boolean>>;
  responseStartTime: number | null;
  setResponseStartTime: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Setup remote mode polling
 */
export function setupRemotePolling({
  remoteUrl,
  setChatHistory,
  setIsWaitingForResponse,
  responseStartTime,
  setResponseStartTime,
}: SetupRemotePollingOptions): () => void {
  let pollInterval: NodeJS.Timeout | null = null;
  let isPolling = false;
  let isMounted = true;

  const pollServerState = async () => {
    if (!isMounted || isPolling) return;
    isPolling = true;

    try {
      const state = await pollRemoteServerState(remoteUrl);
      if (state && isMounted) {
        updateStateFromRemote({
          state,
          setChatHistory,
          setIsWaitingForResponse,
          responseStartTime,
          setResponseStartTime,
        });
      }
    } finally {
      isPolling = false;
    }
  };

  // Start polling immediately
  pollServerState();

  // Set up interval for continuous polling
  pollInterval = setInterval(pollServerState, 500);

  return () => {
    isMounted = false;
    if (pollInterval !== null) {
      clearInterval(pollInterval);
    }
  };
}

interface UpdateStateFromRemoteOptions {
  state: RemoteServerState;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setIsWaitingForResponse: React.Dispatch<React.SetStateAction<boolean>>;
  responseStartTime: number | null;
  setResponseStartTime: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Update local state from remote server state
 */
function updateStateFromRemote({
  state,
  setChatHistory,
  setIsWaitingForResponse,
  responseStartTime,
  setResponseStartTime,
}: UpdateStateFromRemoteOptions): void {
  // Update chat history from server - now using session.history directly
  if (state.session && state.session.history) {
    setChatHistory((prevHistory) => {
      // Use session history directly - it already has the correct type
      const newHistory = state.session.history;

      // Quick length check first
      if (prevHistory.length !== newHistory.length) {
        return newHistory;
      }

      // Deep comparison - check if content actually changed
      const hasChanged = newHistory.some((item, index) => {
        const prevItem = prevHistory[index];
        return (
          !prevItem ||
          prevItem.message.role !== item.message.role ||
          prevItem.message.content !== item.message.content ||
          JSON.stringify(prevItem.toolCallStates) !==
            JSON.stringify(item.toolCallStates)
        );
      });

      // Only update if there are actual changes
      return hasChanged ? newHistory : prevHistory;
    });
  }

  // Update processing state
  setIsWaitingForResponse(state.isProcessing || false);
  if (state.isProcessing && !responseStartTime) {
    setResponseStartTime(Date.now());
  } else if (!state.isProcessing && responseStartTime) {
    setResponseStartTime(null);
  }
}

/**
 * Handle /exit command in remote mode
 */
export async function handleRemoteExit(
  remoteUrl: string,
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>,
  exit: () => void,
): Promise<void> {
  posthogService.capture("useSlashCommand", {
    name: "exit",
  });

  try {
    const response = await fetch(`${remoteUrl}/exit`, {
      method: "POST",
    });

    if (response.ok) {
      setChatHistory((prev) => [
        ...prev,
        {
          message: {
            role: "system",
            content: "Remote environment is shutting down...",
          },
          contextItems: [],
        },
      ]);
      setTimeout(() => exit(), 1000);
    } else {
      const text = await response.text();
      logger.error("Remote shutdown failed:", text);
      setChatHistory((prev) => [
        ...prev,
        {
          message: {
            role: "system",
            content: "Failed to shutdown remote environment",
          },
          contextItems: [],
        },
      ]);
    }
  } catch (error) {
    logger.error("Failed to send exit request to remote server:", error);
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: "Error: Failed to connect to remote server for shutdown",
        },
        contextItems: [],
      },
    ]);
  }
}

interface HandleRemoteMessageOptions {
  remoteUrl: string;
  messageContent: string;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
}

/**
 * Send message to remote server
 */
export async function handleRemoteMessage({
  remoteUrl,
  messageContent,
  setChatHistory,
}: HandleRemoteMessageOptions): Promise<void> {
  try {
    const response = await fetch(`${remoteUrl}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: messageContent }),
    });

    if (!response.ok) {
      const error = await response.json();
      setChatHistory((prev) => [
        ...prev,
        {
          message: {
            role: "system",
            content: `Error: ${error.error || "Failed to send message"}`,
          },
          contextItems: [],
        },
      ]);
    }
    // State will be updated by polling
  } catch (error) {
    logger.error("Failed to send message to remote server:", error);
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: `Error: Failed to connect to remote server`,
        },
        contextItems: [],
      },
    ]);
  }
}
