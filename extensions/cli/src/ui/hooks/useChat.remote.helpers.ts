import type { ChatHistoryItem } from "core/index.js";

import { services } from "../../services/index.js";
import { posthogService } from "../../telemetry/posthogService.js";
import { logger } from "../../util/logger.js";

import { RemoteServerState } from "./useChat.types.js";

function historiesEqual(a: ChatHistoryItem[], b: ChatHistoryItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
  }
  return true;
}

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
  setIsWaitingForResponse: React.Dispatch<React.SetStateAction<boolean>>;
  responseStartTime: number | null;
  setResponseStartTime: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Setup remote mode polling
 */
export function setupRemotePolling({
  remoteUrl,
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
  setIsWaitingForResponse: React.Dispatch<React.SetStateAction<boolean>>;
  responseStartTime: number | null;
  setResponseStartTime: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Update local state from remote server state
 */
function updateStateFromRemote({
  state,
  setIsWaitingForResponse,
  responseStartTime,
  setResponseStartTime,
}: UpdateStateFromRemoteOptions): void {
  // Update chat history from server - now using session.history directly
  if (state.session && state.session.history) {
    const newHistory = state.session.history as ChatHistoryItem[];
    // Let ChatHistoryService own the history and emit updates to UI
    if (!services.chatHistory.isRemoteMode()) {
      services.chatHistory.setRemoteMode(true);
    }
    // Avoid redundant updates: only set when history actually changed
    try {
      const current = services.chatHistory.getHistory();
      const changed = !historiesEqual(current, newHistory);
      if (changed) services.chatHistory.setHistory(newHistory);
    } catch {
      // As a fallback, attempt to set history (service may handle no-op)
      services.chatHistory.setHistory(newHistory);
    }
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
      try {
        services.chatHistory.addSystemMessage(
          "Remote environment is shutting down...",
        );
      } catch (err) {
        logger.error("Failed to add system message", err);
      }
      setTimeout(() => exit(), 1000);
    } else {
      const text = await response.text();
      logger.error("Remote shutdown failed:", text);
      try {
        services.chatHistory.addSystemMessage(
          "Failed to shutdown remote environment",
        );
      } catch {}
    }
  } catch (error) {
    logger.error("Failed to send exit request to remote server:", error);
    try {
      services.chatHistory.addSystemMessage(
        "Error: Failed to connect to remote server for shutdown",
      );
    } catch {}
  }
}

interface HandleRemoteMessageOptions {
  remoteUrl: string;
  messageContent: string;
}

/**
 * Send message to remote server
 */
export async function handleRemoteMessage({
  remoteUrl,
  messageContent,
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
      try {
        services.chatHistory.addSystemMessage(
          `Error: ${error.error || "Failed to send message"}`,
        );
      } catch {}
    }
    // State will be updated by polling
  } catch (error) {
    logger.error("Failed to send message to remote server:", error);
    try {
      services.chatHistory.addSystemMessage(
        "Error: Failed to connect to remote server",
      );
    } catch {}
  }
}

/**
 * Handle /diff command in remote mode
 */
export async function handleRemoteDiff(remoteUrl: string): Promise<void> {
  try {
    const response = await fetch(`${remoteUrl}/diff`);
    if (!response.ok) {
      throw new Error(`Failed to fetch diff: ${response.statusText}`);
    }

    const responseData = await response.json();
    const diffContent = responseData.diff || "";

    if (!diffContent || diffContent.trim() === "") {
      try {
        services.chatHistory.addSystemMessage("No changes to display");
      } catch {}
      return;
    }

    try {
      services.chatHistory.addSystemMessage(`Diff:\n${diffContent}`);
    } catch {}
  } catch (error: any) {
    logger.error("Failed to fetch diff from remote server:", error);
    try {
      services.chatHistory.addSystemMessage(
        `Failed to fetch diff: ${error.message}`,
      );
    } catch {}
  }
}

/**
 * Handle /apply command in remote mode
 */
export async function handleRemoteApply(remoteUrl: string): Promise<void> {
  try {
    const response = await fetch(`${remoteUrl}/diff`);
    if (!response.ok) {
      throw new Error(`Failed to fetch diff: ${response.statusText}`);
    }

    const responseData = await response.json();
    const diffContent = responseData.diff || "";

    if (!diffContent || diffContent.trim() === "") {
      try {
        services.chatHistory.addSystemMessage("No changes to apply");
      } catch {}
      return;
    }

    // Apply the diff using git apply
    const { execFileSync } = await import("child_process");

    try {
      execFileSync("git", ["apply"], {
        input: diffContent,
        stdio: ["pipe", "pipe", "pipe"],
      });

      try {
        services.chatHistory.addSystemMessage(
          "Successfully applied diff to local working tree",
        );
      } catch {}
    } catch (gitError: any) {
      try {
        services.chatHistory.addSystemMessage(
          `Failed to apply diff: ${gitError.message}`,
        );
      } catch {}
    }
  } catch (error: any) {
    logger.error("Failed to fetch diff from remote server:", error);
    try {
      services.chatHistory.addSystemMessage(
        `Failed to fetch diff: ${error.message}`,
      );
    } catch {}
  }
}
