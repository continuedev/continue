import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { useApp } from "ink";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import { useEffect, useState } from "react";
import { toolPermissionManager } from "../../permissions/permissionManager.js";
import { loadSession, saveSession } from "../../session.js";
import { handleSlashCommands } from "../../slashCommands.js";
import {
  StreamCallbacks,
  streamChatResponse,
} from "../../streamChatResponse.js";
import telemetryService from "../../telemetry/telemetryService.js";
import { formatToolCall } from "../../tools/formatters.js";
import { formatError } from "../../util/formatError.js";
import logger from "../../util/logger.js";

import { DisplayMessage } from "../types.js";
import { posthogService } from "../../telemetry/posthogService.js";
import { initializeChatHistory } from "../../commands/chat.js";

interface UseChatProps {
  assistant?: AssistantUnrolled;
  model?: ModelConfig;
  llmApi?: BaseLlmApi;
  initialPrompt?: string;
  resume?: boolean;
  additionalRules?: string[];
  onShowOrgSelector: () => void;
  onShowConfigSelector: () => void;
  onShowModelSelector?: () => void;
  onLoginPrompt?: (promptText: string) => Promise<string>;
  onReload?: () => Promise<void>;
  // Remote mode props
  isRemoteMode?: boolean;
  remoteUrl?: string;
}

export function useChat({
  assistant,
  model,
  llmApi,
  initialPrompt,
  resume,
  additionalRules,
  onShowOrgSelector,
  onShowConfigSelector,
  onShowModelSelector,
  onLoginPrompt,
  onReload,
  isRemoteMode = false,
  remoteUrl,
}: UseChatProps) {
  const { exit } = useApp();

  const [chatHistory, setChatHistory] = useState<ChatCompletionMessageParam[]>(
    () => {
      // In remote mode, start with empty history (will be populated by polling)
      if (isRemoteMode) {
        return [];
      }

      // Synchronously initialize chat history to prevent race conditions
      // This ensures system message is always loaded before handleUserMessage runs
      let initialHistory: ChatCompletionMessageParam[] = [];

      // Load previous session if resume flag is used
      if (resume) {
        const savedHistory = loadSession();
        if (savedHistory) {
          initialHistory = savedHistory;
        }
      }

      // If no session loaded or not resuming, we'll need to add system message
      // We can't make this async, so we'll handle it in the useEffect
      return initialHistory;
    }
  );

  const [messages, setMessages] = useState<DisplayMessage[]>(() => {
    if (resume) {
      const savedHistory = loadSession();
      if (savedHistory) {
        return savedHistory
          .filter((msg) => msg.role !== "system")
          .map((msg) => ({
            role: msg.role,
            content: msg.content as string,
          }));
      }
    }
    return [];
  });

  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<number | null>(
    null
  );
  const [inputMode, setInputMode] = useState(true);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [isChatHistoryInitialized, setIsChatHistoryInitialized] = useState(
    // If we're resuming and found a saved session, we're already initialized
    // If we're in remote mode, we're initialized (will be populated by polling)
    isRemoteMode || (resume && loadSession() !== null)
  );
  
  // Capture initial rules to prevent re-initialization when rules change
  const [initialRules] = useState(additionalRules);
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ path: string; content: string }>
  >([]);
  const [activePermissionRequest, setActivePermissionRequest] = useState<{
    toolName: string;
    toolArgs: any;
    requestId: string;
  } | null>(null);

  // Remote mode polling
  useEffect(() => {
    if (!isRemoteMode || !remoteUrl || process.env.NODE_ENV === "test") return;

    let pollInterval: NodeJS.Timeout | null = null;
    let isPolling = false;
    let isMounted = true;

    const pollServerState = async () => {
      if (isPolling || !isMounted) return; // Prevent overlapping polls and check if still mounted
      isPolling = true;

      try {
        const response = await fetch(`${remoteUrl}/state`);
        if (response.ok && isMounted) {
          const state = await response.json();

          // Update messages from server
          if (state.chatHistory) {
            // Only update if the chat history has actually changed
            setMessages((prevMessages) => {
              // Quick length check first
              if (prevMessages.length !== state.chatHistory.length) {
                return state.chatHistory;
              }

              // Deep comparison - check if content actually changed
              const hasChanged = state.chatHistory.some(
                (msg: any, index: number) => {
                  const prevMsg = prevMessages[index];
                  return (
                    !prevMsg ||
                    prevMsg.role !== msg.role ||
                    prevMsg.content !== msg.content ||
                    prevMsg.messageType !== msg.messageType ||
                    prevMsg.toolName !== msg.toolName ||
                    prevMsg.toolResult !== msg.toolResult
                  );
                }
              );

              // Only update if there are actual changes
              return hasChanged ? state.chatHistory : prevMessages;
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

              const hasChanged = newChatHistory.some(
                (msg: any, index: number) => {
                  const prevMsg = prevChatHistory[index];
                  return (
                    !prevMsg ||
                    prevMsg.role !== msg.role ||
                    prevMsg.content !== msg.content
                  );
                }
              );

              return hasChanged ? newChatHistory : prevChatHistory;
            });
          }

          // Update processing state
          if (isMounted) {
            setIsWaitingForResponse(state.isProcessing || false);
            if (state.isProcessing && !responseStartTime) {
              setResponseStartTime(Date.now());
            } else if (!state.isProcessing && responseStartTime) {
              setResponseStartTime(null);
            }
          }
        }
      } catch (error) {
        if (isMounted) {
          logger.error("Failed to poll server state:", error);
        }
      } finally {
        isPolling = false;
      }
    };

    // Start polling immediately
    pollServerState();

    // Set up interval for continuous polling
    pollInterval = setInterval(pollServerState, 500); // Poll every 500ms

    return () => {
      isMounted = false;
      if (pollInterval !== null) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, [isRemoteMode, remoteUrl, responseStartTime]);

  useEffect(() => {
    // Skip initialization in remote mode or if already initialized
    if (isRemoteMode || isChatHistoryInitialized) return;

    // Initialize chat history with system message only if we don't have a session
    const initializeHistory = async () => {
      // Only add system message if we don't have any messages yet
      if (chatHistory.length === 0) {
        const history = await initializeChatHistory({
          resume,
          rule: initialRules,
        });
        setChatHistory(history);
      }
      setIsChatHistoryInitialized(true);
    };

    initializeHistory();
    // Note: Using initialRules instead of additionalRules to prevent re-initialization
    // when rules change during the conversation
  }, [isRemoteMode, isChatHistoryInitialized, chatHistory.length, resume, initialRules]);

  useEffect(() => {
    // Only handle initial prompt after chat history is initialized
    // This prevents race conditions where the prompt runs before system message is loaded
    if (initialPrompt && isChatHistoryInitialized) {
      handleUserMessage(initialPrompt);
    }
  }, [initialPrompt, isChatHistoryInitialized]);

  const handleUserMessage = async (message: string) => {
    // Special handling for /org command in TUI
    if (message.trim() === "/org") {
      posthogService.capture("useSlashCommand", {
        name: "org",
      });
      onShowOrgSelector();
      return;
    }

    // Special handling for /config command in TUI
    if (message.trim() === "/config") {
      posthogService.capture("useSlashCommand", {
        name: "config",
      });
      onShowConfigSelector();
      return;
    }

    // Handle /exit command in remote mode
    if (isRemoteMode && remoteUrl && message.trim() === "/exit") {
      posthogService.capture("useSlashCommand", {
        name: "exit",
      });
      try {
        // Send POST request to /exit endpoint
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

          // Exit the local client after a brief delay
          setTimeout(() => {
            exit();
          }, 1000);
        } else {
          const text = await response.text();
          logger.error("Remote shutdown failed:", text);
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: "Failed to shut down remote environment",
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
      return;
    }

    // Handle slash commands (skip in remote mode except for /exit which we handled above)
    if (!isRemoteMode && assistant) {
      const commandResult = await handleSlashCommands(
        message,
        assistant,
        onLoginPrompt
      );
      if (commandResult) {
        if (commandResult.exit) {
          exit();
          return;
        }

        if (commandResult.openConfigSelector) {
          onShowConfigSelector();
          return;
        }

        if (commandResult.openModelSelector && onShowModelSelector) {
          onShowModelSelector();
          return;
        }

        if (commandResult.clear) {
          const systemMessage = chatHistory.find(
            (msg) => msg.role === "system"
          );
          const newHistory = systemMessage ? [systemMessage] : [];
          setChatHistory(newHistory);
          setMessages([]);

          if (commandResult.output) {
            const output = commandResult.output;
            setMessages([
              {
                role: "system",
                content: output,
                messageType: "system" as const,
              },
            ]);
          }
          return;
        }

        if (commandResult.output) {
          const output = commandResult.output;
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: output,
              messageType: "system" as const,
            },
          ]);
        }

        if (commandResult.newInput) {
          message = commandResult.newInput;
        } else {
          return;
        }
      }
    }

    // Start active time tracking for telemetry
    telemetryService.startActiveTime();

    // Track user prompt
    telemetryService.logUserPrompt(message.length, message);
    posthogService.capture("chat", {
      model: model?.name,
      provider: model?.provider,
    });

    // Add user message to history and display
    let messageContent = message;

    if (attachedFiles.length > 0) {
      const fileContents = attachedFiles
        .map(
          (file) => `\n\n<file path="${file.path}">\n${file.content}\n</file>`
        )
        .join("");
      messageContent = `${message}${fileContents}`;
      setAttachedFiles([]);
    }

    // In remote mode, send message to server instead of processing locally
    if (isRemoteMode && remoteUrl) {
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
      return;
    }

    // Local mode: process message normally
    const newUserMessage: ChatCompletionMessageParam = {
      role: "user",
      content: messageContent,
    };
    const newHistory = [...chatHistory, newUserMessage];
    setChatHistory(newHistory);
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    // Start streaming response
    const controller = new AbortController();
    setAbortController(controller);
    setIsWaitingForResponse(true);
    setResponseStartTime(Date.now());
    setInputMode(false);
    logger.debug("Starting chat response stream", {
      messageLength: message.length,
      historyLength: newHistory.length,
    });

    try {
      let currentStreamingMessage: DisplayMessage | null = null;

      const streamCallbacks: StreamCallbacks = {
        onContent: (content: string) => {
          if (!currentStreamingMessage) {
            currentStreamingMessage = {
              role: "assistant",
              content: "",
              isStreaming: true,
            };
          }
          currentStreamingMessage.content += content;
        },
        onContentComplete: (content: string) => {
          if (currentStreamingMessage) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: content,
                isStreaming: false,
              },
            ]);
            currentStreamingMessage = null;
          }
        },
        onToolStart: (toolName: string, toolArgs?: any) => {
          if (currentStreamingMessage && currentStreamingMessage.content) {
            const messageContent = currentStreamingMessage.content;
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: messageContent,
                isStreaming: false,
              },
            ]);
            currentStreamingMessage = null;
          }

          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: formatToolCall(toolName, toolArgs),
              messageType: "tool-start",
              toolName,
            },
          ]);
        },
        onToolResult: (result: string, toolName: string) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            for (let i = newMessages.length - 1; i >= 0; i--) {
              if (
                newMessages[i].messageType === "tool-start" &&
                newMessages[i].toolName === toolName
              ) {
                newMessages[i] = {
                  ...newMessages[i],
                  messageType: "tool-result",
                  toolResult: result,
                };
                break;
              }
            }
            return newMessages;
          });
        },
        onToolError: (error: string, toolName?: string) => {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: error,
              messageType: "tool-error",
              toolName,
            },
          ]);
        },
        onToolPermissionRequest: (
          toolName: string,
          toolArgs: any,
          requestId: string
        ) => {
          // Set the active permission request to show the selector
          setActivePermissionRequest({
            toolName,
            toolArgs,
            requestId,
          });
        },
      };

      // Call streamChatResponse with the new history that includes the user message
      const finalHistory = [...newHistory];
      if (model && llmApi) {
        await streamChatResponse(
          finalHistory,
          model,
          llmApi,
          controller,
          streamCallbacks
        );
      }

      if (currentStreamingMessage && (currentStreamingMessage as any).content) {
        const messageContent = (currentStreamingMessage as any).content;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: messageContent,
            isStreaming: false,
          },
        ]);
      }

      // Update the chat history with the complete conversation after streaming
      setChatHistory(finalHistory);
      logger.debug("Chat history updated", {
        finalHistoryLength: finalHistory.length,
      });

      // Save the updated history to session
      logger.debug("Saving session", { historyLength: finalHistory.length });
      saveSession(finalHistory);
      logger.debug("Session saved");
    } catch (error: any) {
      const errorMessage = `Error: ${formatError(error)}`;
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: errorMessage,
          messageType: "system" as const,
        },
      ]);
    } finally {
      // Stop active time tracking
      telemetryService.stopActiveTime();

      setAbortController(null);
      setIsWaitingForResponse(false);
      setResponseStartTime(null);
      setInputMode(true);
    }
  };

  const handleInterrupt = () => {
    // In remote mode, send interrupt signal to server
    if (isRemoteMode && remoteUrl) {
      // Send a message to interrupt the remote server
      fetch(`${remoteUrl}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "" }), // Empty message triggers interrupt
      }).catch((error) => {
        logger.error("Failed to send interrupt to remote server:", error);
      });
      return;
    }

    // Local mode: abort the controller
    if (abortController && isWaitingForResponse) {
      abortController.abort();
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "[Interrupted by user]",
          messageType: "system" as const,
        },
      ]);
    }
  };

  const handleFileAttached = (filePath: string, content: string) => {
    setAttachedFiles((prev) => [...prev, { path: filePath, content }]);
  };

  const resetChatHistory = async () => {
    const newHistory = await initializeChatHistory({
      resume: false, // Don't resume when resetting
      rule: additionalRules,
    });
    setChatHistory(newHistory);
    setMessages([]);
  };

  const handleToolPermissionResponse = async (
    requestId: string,
    approved: boolean,
    createPolicy?: boolean
  ) => {
    // Capture the current permission request before clearing it
    const currentRequest = activePermissionRequest;

    // Clear the active permission request
    setActivePermissionRequest(null);

    // Handle policy creation if requested
    if (approved && createPolicy && currentRequest) {
      try {
        const { generatePolicyRule, addPolicyToYaml } = await import(
          "../../permissions/policyWriter.js"
        );

        const policyRule = generatePolicyRule(
          currentRequest.toolName,
          currentRequest.toolArgs
        );

        await addPolicyToYaml(policyRule);

        logger.debug(`Policy created: ${policyRule}`);
      } catch (error) {
        logger.error("Failed to create policy", { error });
        // Continue with the approval even if policy creation fails
      }
    }

    // Send response to permission manager
    // The streamChatResponse will handle showing the appropriate message
    // through its normal onToolStart/onToolError flow
    if (approved) {
      toolPermissionManager.approveRequest(requestId);
    } else {
      toolPermissionManager.rejectRequest(requestId);
    }
  };

  return {
    messages,
    setMessages,
    chatHistory,
    setChatHistory,
    isWaitingForResponse,
    responseStartTime,
    inputMode,
    attachedFiles,
    activePermissionRequest,
    handleUserMessage,
    handleInterrupt,
    handleFileAttached,
    resetChatHistory,
    handleToolPermissionResponse,
  };
}
