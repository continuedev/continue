import { ChatCompletionMessageParam } from "openai/resources.mjs";

import { posthogService } from "../../telemetry/posthogService.js";
import { logger } from "../../util/logger.js";
import { DisplayMessage } from "../types.js";

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
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  setChatHistory: React.Dispatch<
    React.SetStateAction<ChatCompletionMessageParam[]>
  >;
  setIsWaitingForResponse: React.Dispatch<React.SetStateAction<boolean>>;
  responseStartTime: number | null;
  setResponseStartTime: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Setup remote mode polling
 */
export function setupRemotePolling({
  remoteUrl,
  setMessages,
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
          setMessages,
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
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  setChatHistory: React.Dispatch<
    React.SetStateAction<ChatCompletionMessageParam[]>
  >;
  setIsWaitingForResponse: React.Dispatch<React.SetStateAction<boolean>>;
  responseStartTime: number | null;
  setResponseStartTime: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Update local state from remote server state
 */
function updateStateFromRemote({
  state,
  setMessages,
  setChatHistory,
  setIsWaitingForResponse,
  responseStartTime,
  setResponseStartTime,
}: UpdateStateFromRemoteOptions): void {
  // Update messages from server
  if (state.chatHistory) {
    setMessages((prevMessages) => {
      // Quick length check first
      if (prevMessages.length !== state.chatHistory.length) {
        return state.chatHistory as DisplayMessage[];
      }

      // Deep comparison - check if content actually changed
      const hasChanged = state.chatHistory.some((msg: any, index: number) => {
        const prevMsg = prevMessages[index];
        return (
          !prevMsg ||
          prevMsg.role !== msg.role ||
          prevMsg.content !== msg.content ||
          prevMsg.messageType !== msg.messageType ||
          prevMsg.toolName !== msg.toolName ||
          prevMsg.toolResult !== msg.toolResult
        );
      });

      // Only update if there are actual changes
      return hasChanged
        ? (state.chatHistory as DisplayMessage[])
        : prevMessages;
    });

    // Also update chat history for consistency
    setChatHistory((prevChatHistory) => {
      const newChatHistory = state.chatHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Similar comparison for chat history
      if (prevChatHistory.length !== newChatHistory.length) {
        return newChatHistory;
      }

      const hasChanged = newChatHistory.some((msg: any, index: number) => {
        const prevMsg = prevChatHistory[index];
        return (
          !prevMsg ||
          prevMsg.role !== msg.role ||
          prevMsg.content !== msg.content
        );
      });

      return hasChanged ? newChatHistory : prevChatHistory;
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
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>,
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
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "Remote environment is shutting down...",
          messageType: "system" as const,
        },
      ]);
      setTimeout(() => exit(), 1000);
    } else {
      const text = await response.text();
      logger.error("Remote shutdown failed:", text);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "Failed to shutdown remote environment",
          messageType: "system" as const,
        },
      ]);
    }
  } catch (error) {
    logger.error("Failed to send exit request to remote server:", error);
    setMessages((prev) => [
      ...prev,
      {
        role: "system",
        content: "Error: Failed to connect to remote server for shutdown",
        messageType: "system" as const,
      },
    ]);
  }
}

interface HandleRemoteMessageOptions {
  remoteUrl: string;
  messageContent: string;
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
}

/**
 * Send message to remote server
 */
export async function handleRemoteMessage({
  remoteUrl,
  messageContent,
  setMessages,
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
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `Error: ${error.error || "Failed to send message"}`,
          messageType: "system" as const,
        },
      ]);
    }
    // State will be updated by polling
  } catch (error) {
    logger.error("Failed to send message to remote server:", error);
    setMessages((prev) => [
      ...prev,
      {
        role: "system",
        content: `Error: Failed to connect to remote server`,
        messageType: "system" as const,
      },
    ]);
  }
}
