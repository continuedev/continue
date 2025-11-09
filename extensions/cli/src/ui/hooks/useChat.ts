/* eslint-disable max-lines */
/* eslint-disable max-statements   */
import type { ChatHistoryItem, Session } from "core/index.js";
import { useApp } from "ink";
import { useEffect, useRef, useState } from "react";

import { findCompactionIndex } from "../../compaction.js";
import { toolPermissionManager } from "../../permissions/permissionManager.js";
import { services } from "../../services/index.js";
import {
  createSession,
  loadSession,
  updateSessionHistory,
} from "../../session.js";
import { handleSlashCommands } from "../../slashCommands.js";
import { messageQueue, QueuedMessage } from "../../stream/messageQueue.js";
import { telemetryService } from "../../telemetry/telemetryService.js";
import { formatError } from "../../util/formatError.js";
import { logger } from "../../util/logger.js";

import {
  handleAutoCompaction,
  handleCompactCommand,
} from "./useChat.compaction.js";
import {
  formatMessageWithFiles,
  handleSpecialCommands,
  initChatHistory,
  processSlashCommandResult,
  trackUserMessage,
} from "./useChat.helpers.js";
import {
  handleRemoteMessage,
  setupRemotePolling,
} from "./useChat.remote.helpers.js";
import { handleBashModeProcessing } from "./useChat.shellMode.js";
import {
  createStreamCallbacks,
  executeStreaming,
} from "./useChat.stream.helpers.js";
import {
  ActivePermissionRequest,
  AttachedFile,
  UseChatProps,
} from "./useChat.types.js";

export function useChat({
  assistant,
  model,
  llmApi,
  initialPrompt,
  resume,
  fork,
  additionalRules,
  additionalPrompts,
  onShowConfigSelector,
  onShowModelSelector,
  onShowUpdateSelector,
  onShowMCPSelector,
  onShowSessionSelector,
  onClear,
  onRefreshStatic,
  isRemoteMode = false,
  remoteUrl,
  onShowDiff,
  onShowStatusMessage,
}: UseChatProps) {
  const { exit } = useApp();

  // Track service subscription
  const serviceListenerCleanupRef = useRef<null | (() => void)>(null);

  // Store the current session
  const [currentSession, setCurrentSession] = useState<Session>(() => {
    // In remote mode, start with empty session (will be populated by polling)
    if (isRemoteMode) {
      return createSession([]);
    }

    // Fork from an existing session if fork flag is used
    if (fork) {
      const { loadSessionById, startNewSession } = require("../../session.js");
      const sessionToFork = loadSessionById(fork);
      if (sessionToFork) {
        return startNewSession(sessionToFork.history);
      }
      // If session not found, create a new empty session
      return createSession([]);
    }

    // Load previous session if resume flag is used
    if (resume) {
      const savedSession = loadSession();
      if (savedSession) {
        return savedSession;
      }
    }

    // Create new session
    return createSession([]);
  });

  // Local view of history driven solely by ChatHistoryService
  const [chatHistory, setChatHistoryView] = useState<ChatHistoryItem[]>(() =>
    services.chatHistory?.isReady()
      ? services.chatHistory.getHistory()
      : currentSession.history,
  );
  // Proxy setter: apply changes to ChatHistoryService (single source of truth)
  const setChatHistory: React.Dispatch<
    React.SetStateAction<ChatHistoryItem[]>
  > = (value) => {
    const svc = services.chatHistory;
    const current = svc.getHistory();
    const next = typeof value === "function" ? (value as any)(current) : value;
    svc.setHistory(next);
  };

  // Initialize ChatHistoryService and subscribe to updates
  useEffect(() => {
    const svc = services.chatHistory;
    svc
      .initialize(currentSession, isRemoteMode)
      .then(() => {
        setChatHistoryView(svc.getHistory());
        const listener = () => {
          setChatHistoryView(svc.getHistory());
        };
        svc.on("stateChanged", listener);
        serviceListenerCleanupRef.current = () =>
          svc.off("stateChanged", listener);
      })
      .catch((error) => {
        logger.error("Failed to initialize ChatHistoryService", { error });
      });

    return () => {
      serviceListenerCleanupRef.current?.();
      serviceListenerCleanupRef.current = null;
    };
  }, []);

  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<number | null>(
    null,
  );
  const [isCompacting, setIsCompacting] = useState(false);
  const [compactionStartTime, setCompactionStartTime] = useState<number | null>(
    null,
  );
  const [inputMode, setInputMode] = useState(true);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [compactionAbortController, setCompactionAbortController] =
    useState<AbortController | null>(null);
  const [isChatHistoryInitialized, setIsChatHistoryInitialized] = useState(
    // If we're resuming and found a saved session, we're already initialized
    // If we're forking and found a session to fork from, we're already initialized
    // If we're in remote mode, we're initialized (will be populated by polling)
    isRemoteMode ||
      (resume && currentSession.history.length > 0) ||
      (fork && currentSession.history.length > 0),
  );

  // Capture initial rules to prevent re-initialization when rules change
  const [initialRules] = useState(additionalRules);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [activePermissionRequest, setActivePermissionRequest] =
    useState<ActivePermissionRequest | null>(null);
  const [compactionIndex, setCompactionIndex] = useState<number | null>(() => {
    // When resuming or forking, check for compaction markers in the loaded history
    if ((resume || fork) && currentSession.history.length > 0) {
      return findCompactionIndex(currentSession.history);
    }
    return null;
  });

  // Track interrupted state for resume functionality
  const [wasInterrupted, setWasInterrupted] = useState(false);

  // Track queued messages for immediate display
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);

  // Set up message queue listeners
  useEffect(() => {
    const onMessageQueued = (queuedMessage: QueuedMessage) => {
      setQueuedMessages((prev) => [...prev, queuedMessage]);
    };

    messageQueue.on("messageQueued", onMessageQueued);

    return () => {
      messageQueue.off("messageQueued", onMessageQueued);
    };
  }, []);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortController && !abortController.signal.aborted) {
        abortController.abort();
      }
    };
  }, [abortController]);

  // Remote mode polling
  useEffect(() => {
    if (!isRemoteMode || !remoteUrl || process.env.NODE_ENV === "test") return;

    return setupRemotePolling({
      remoteUrl,
      setIsWaitingForResponse,
      responseStartTime,
      setResponseStartTime,
    });
  }, [isRemoteMode, remoteUrl, responseStartTime]);

  useEffect(() => {
    // Skip initialization in remote mode or if already initialized
    if (isRemoteMode || isChatHistoryInitialized) return;

    // Initialize chat history with system message only if we don't have a session
    const initializeHistory = async () => {
      // Only add system message if we don't have any messages yet
      if (chatHistory.length === 0) {
        const history = await initChatHistory(resume, initialRules);
        setChatHistory(history);
      }
      setIsChatHistoryInitialized(true);
    };

    initializeHistory();
    // Note: Using initialRules instead of additionalRules to prevent re-initialization
    // when rules change during the conversation
  }, [
    isRemoteMode,
    isChatHistoryInitialized,
    chatHistory.length,
    resume,
    initialRules,
  ]);

  useEffect(() => {
    // Only handle initial prompt after chat history is initialized
    // This prevents race conditions where the prompt runs before system message is loaded
    if (
      (initialPrompt || (additionalPrompts && additionalPrompts.length > 0)) &&
      isChatHistoryInitialized
    ) {
      const processPrompts = async () => {
        const { processAndCombinePrompts } = await import(
          "../../util/promptProcessor.js"
        );
        const finalMessage = await processAndCombinePrompts(
          additionalPrompts,
          initialPrompt,
        );

        if (finalMessage) {
          await handleUserMessage(finalMessage);
        }
      };

      processPrompts().catch(console.error);
    }
  }, [initialPrompt, additionalPrompts, isChatHistoryInitialized]);

  const executeStreamingResponse = async (
    newHistory: ChatHistoryItem[],
    currentCompactionIndex: number | null,
  ) => {
    // Clean up previous abort controller if it exists
    if (abortController && !abortController.signal.aborted) {
      abortController.abort();
    }

    // Start streaming response
    const controller = new AbortController();
    setAbortController(controller);
    setIsWaitingForResponse(true);
    setResponseStartTime(Date.now());
    setInputMode(false);
    logger.debug("Starting chat response stream", {
      historyLength: newHistory.length,
    });

    try {
      const streamCallbacks = createStreamCallbacks({
        setChatHistory: setChatHistory,
        setActivePermissionRequest,
        llmApi,
        model,
      });

      // Execute streaming chat response
      await executeStreaming({
        chatHistory: newHistory,
        model,
        llmApi,
        controller,
        streamCallbacks,
        currentCompactionIndex,
      });

      // Save the updated session with the latest chat history that includes the assistant's reply
      // The streamCallbacks update setChatHistory during streaming, so we need to get the current state
      setChatHistory((currentHistory) => {
        const updatedSession: Session = {
          ...currentSession,
          history: currentHistory,
        };
        updateSessionHistory(currentHistory);
        setCurrentSession(updatedSession);
        logger.debug("Session saved");
        return currentHistory;
      });
    } catch (error: any) {
      const errorMessage = `Error: ${formatError(error)}`;
      setChatHistory((prev) => [
        ...prev,
        {
          message: {
            role: "system",
            content: errorMessage,
          },
          contextItems: [],
        },
      ]);
    } finally {
      // Stop active time tracking
      telemetryService.stopActiveTime();

      setAbortController(null);
      setIsWaitingForResponse(false);
      setResponseStartTime(null);
      setInputMode(true);

      // Check if there are queued messages and process them after a microtask delay
      // This ensures the GUI state has been updated before processing the next message
      const queuedMessageData = messageQueue.getNextMessage();
      if (queuedMessageData) {
        const { message: latestQueuedMessage, imageMap } = queuedMessageData;
        logger.debug("processing queued message", { latestQueuedMessage });

        // Clear queued messages from display since they're about to be processed
        // Note: messageQueue.getNextMessage() already cleared the actual queue
        setQueuedMessages([]);

        await new Promise((resolve) => setTimeout(resolve, 100)); // add timeout for react to render the tui

        // Process the queued message - it will handle adding to history and compaction display
        await processQueuedMessage(latestQueuedMessage, imageMap);
      }
    }
  };

  const handleResumeRequest = async (message: string) => {
    if (message !== "" || !wasInterrupted) return false;

    // Find the index of the last user or tool message to resume from
    let lastUserOrToolIndex = -1;
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      if (
        chatHistory[i].message.role === "user" ||
        !!chatHistory[i].toolCallStates?.length
      ) {
        lastUserOrToolIndex = i;
        break;
      }
    }

    if (lastUserOrToolIndex >= 0) {
      // Truncate history to include up to and including the user/tool message
      const truncatedHistory = chatHistory.slice(0, lastUserOrToolIndex + 1);
      setChatHistory(truncatedHistory);

      // Clear the interrupted state and resume
      setWasInterrupted(false);

      // Re-execute streaming with the truncated history
      await executeStreamingResponse(truncatedHistory, compactionIndex);
      return true;
    }

    return false;
  };

  const handleSlashCommandProcessing = async (
    message: string,
  ): Promise<string | null> => {
    // Handle slash commands
    if (!assistant) {
      return message;
    }

    const commandResult = await handleSlashCommands(message, assistant, {
      remoteUrl,
      isRemoteMode,
    });

    if (!commandResult) {
      return message;
    }

    if (commandResult.compact) {
      await handleCompactCommand({
        chatHistory,
        model,
        llmApi,
        setChatHistory,
        setCompactionIndex,
        currentSession,
        setCurrentSession,
        setIsCompacting,
        setCompactionStartTime,
        setCompactionAbortController,
      });
      return null;
    }

    const newInput = processSlashCommandResult({
      result: commandResult,
      chatHistory,
      setChatHistory,
      onShowConfigSelector,
      onShowModelSelector,
      onShowMCPSelector,
      onShowSessionSelector,
      onShowUpdateSelector,
      onClear,
    });

    return newInput || null;
  };

  const convertMessageContentToString = (content: any): string => {
    if (typeof content === "string") {
      return content;
    }

    // Convert MessagePart[] to string (extracting text, noting images)
    return content
      .map((part: any) => {
        if (part.type === "text") {
          return part.text;
        } else if (part.type === "imageUrl") {
          return "[Image]";
        }
        return "";
      })
      .join("");
  };

  const processMessage = async (
    message: string,
    imageMap?: Map<string, Buffer>,
    isQueuedMessage: boolean = false,
    baseHistory?: ChatHistoryItem[],
  ) => {
    // Use baseHistory if provided (e.g., when editing a message),
    // otherwise use current chatHistory
    const currentHistory = baseHistory ?? chatHistory;
    // Handle special commands
    const handled = await handleSpecialCommands({
      message,
      isRemoteMode,
      remoteUrl,
      onShowConfigSelector,
      exit,
      onShowDiff,
      onShowStatusMessage,
    });

    if (handled) return;

    // Handle shell mode commands (before slash commands)
    const bashProcessedMessage = await handleBashModeProcessing(message);
    if (bashProcessedMessage === null) {
      return; // Bash command was handled and no further processing needed
    }
    message = bashProcessedMessage;

    // Handle slash commands (MUST happen before remote message handling)
    const processedMessage = await handleSlashCommandProcessing(message);
    if (processedMessage === null) {
      return; // Command was handled and no further processing needed
    }
    message = processedMessage;

    // Track telemetry
    trackUserMessage(message, model);

    // In remote mode, send message to server instead of processing locally
    if (isRemoteMode && remoteUrl) {
      const messageContentString = convertMessageContentToString(message);

      await handleRemoteMessage({
        remoteUrl,
        messageContent: messageContentString,
      });
      return;
    }

    // For non-queued messages, format and add to chat history
    if (isQueuedMessage) {
      // For queued messages, we need to format and add to history after compaction
      // First, format the message
      const formattedQueuedMessage = await formatMessageWithFiles(
        message,
        [], // No attached files for queued messages
        imageMap,
      );

      // Check if auto-compacting is needed with current history
      const compactionController = new AbortController();
      setCompactionAbortController(compactionController);
      setIsCompacting(true);
      setCompactionStartTime(Date.now());

      // Add the queued message to queue display during compaction
      const queuedMessageForDisplay: QueuedMessage = {
        message,
        imageMap,
        timestamp: Date.now(),
      };
      setQueuedMessages((prev) => [...prev, queuedMessageForDisplay]);

      let currentChatHistory, currentCompactionIndex;
      try {
        const result = await handleAutoCompaction({
          chatHistory: currentHistory,
          model,
          llmApi,
          compactionIndex,
          setChatHistory: setChatHistory,
          setCompactionIndex,
          abortController: compactionController,
        });
        currentChatHistory = result.currentChatHistory;
        currentCompactionIndex = result.currentCompactionIndex;
      } catch (error) {
        // If compaction fails, remove the queued message from display
        setQueuedMessages((prev) =>
          prev.filter((msg) => msg !== queuedMessageForDisplay),
        );
        throw error; // Re-throw to maintain error handling
      } finally {
        setIsCompacting(false);
        setCompactionStartTime(null);
        setCompactionAbortController(null);
      }

      // Add the formatted queued message to history after compaction completes
      const newHistory = [...currentChatHistory, formattedQueuedMessage];
      setChatHistory(newHistory);

      // Remove the queued message from display since it's now in chat history
      setQueuedMessages((prev) =>
        prev.filter((msg) => msg !== queuedMessageForDisplay),
      );

      // Execute the streaming response with the updated history
      await executeStreamingResponse(newHistory, currentCompactionIndex);
    } else {
      // Format message with attached files and images
      logger.debug("Processing message with images", {
        hasImages: !!(imageMap && imageMap.size > 0),
        imageCount: imageMap?.size || 0,
      });
      const newUserMessage = await formatMessageWithFiles(
        message,
        attachedFiles,
        imageMap,
      );
      logger.debug("Message formatted successfully");

      if (attachedFiles.length > 0) {
        setAttachedFiles([]);
      }

      // Check if auto-compacting is needed BEFORE adding user message
      const compactionController = new AbortController();
      setCompactionAbortController(compactionController);
      setIsCompacting(true);
      setCompactionStartTime(Date.now());

      // Add the triggering message to queue display during compaction
      const compactionQueuedMessage: QueuedMessage = {
        message,
        imageMap,
        timestamp: Date.now(),
      };
      setQueuedMessages((prev) => [...prev, compactionQueuedMessage]);

      let currentChatHistory, currentCompactionIndex;
      try {
        const result = await handleAutoCompaction({
          chatHistory: currentHistory,
          model,
          llmApi,
          compactionIndex,
          setChatHistory: setChatHistory,
          setCompactionIndex,
          abortController: compactionController,
        });
        currentChatHistory = result.currentChatHistory;
        currentCompactionIndex = result.currentCompactionIndex;
      } catch (error) {
        // If compaction fails, remove the triggering message from queue display
        setQueuedMessages((prev) =>
          prev.filter((msg) => msg !== compactionQueuedMessage),
        );
        throw error; // Re-throw to maintain error handling
      } finally {
        setIsCompacting(false);
        setCompactionStartTime(null);
        setCompactionAbortController(null);
      }

      // Add the formatted user message to history
      const newHistory = [...currentChatHistory, newUserMessage];
      setChatHistory(newHistory);

      // Remove the triggering message from queue display since it's now in chat history
      setQueuedMessages((prev) =>
        prev.filter((msg) => msg !== compactionQueuedMessage),
      );

      // Execute the streaming response
      await executeStreamingResponse(newHistory, currentCompactionIndex);
    }
  };

  const processQueuedMessage = async (
    message: string,
    imageMap?: Map<string, Buffer>,
  ) => {
    // For queued messages, we can reuse the core message processing logic
    // by calling the internal processing function directly
    await processMessage(message, imageMap, true);
  };

  const handleUserMessage = async (
    message: string,
    imageMap?: Map<string, Buffer>,
  ) => {
    // Check if this is a resume request (empty message after interruption)
    if (await handleResumeRequest(message)) {
      return;
    }

    // Clear interrupted state if user types a new message
    if (wasInterrupted && message !== "") {
      setWasInterrupted(false);
    }

    // Use the common message processing logic
    await processMessage(message, imageMap, false);
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

    // Local mode: abort the appropriate controller

    // If compaction is running, abort compaction
    if (compactionAbortController && isCompacting) {
      compactionAbortController.abort();
      setIsCompacting(false);
      setCompactionStartTime(null);
      setCompactionAbortController(null);
      setInputMode(true);
      // Clear any queued messages (including the triggering message) when compaction is interrupted
      setQueuedMessages([]);
      return;
    }

    // If response is running, abort response
    if (abortController && isWaitingForResponse) {
      abortController.abort();

      // Remove the last message if it's from assistant (partial response)
      setChatHistory((current) => {
        const lastMessage = current[current.length - 1];
        if (
          lastMessage?.message.role === "assistant" &&
          !lastMessage.toolCallStates?.length
        ) {
          return current.slice(0, -1);
        }
        return current;
      });

      setWasInterrupted(true);
      setIsWaitingForResponse(false);
      setResponseStartTime(null);
      setInputMode(true);
    }
  };

  const handleFileAttached = (filePath: string, content: string) => {
    setAttachedFiles((prev) => [...prev, { path: filePath, content }]);
  };

  const resetChatHistory = async () => {
    const newHistory = await initChatHistory(
      false, // Don't resume when resetting
      additionalRules,
    );
    setChatHistory(newHistory);
    // Clear any queued messages when resetting chat
    setQueuedMessages([]);
  };

  const handleEditMessage = async (
    messageIndex: number,
    newContent: string,
  ) => {
    logger.debug("handleEditMessage called", {
      messageIndex,
      currentHistoryLength: chatHistory.length,
    });

    // Rewind chat history to exclude the message being edited
    const rewindedHistory = chatHistory.slice(0, messageIndex);

    logger.debug("Rewinding history for edit", {
      from: chatHistory.length,
      to: rewindedHistory.length,
    });

    // Clear any queued messages
    setQueuedMessages([]);

    // Clear attached files
    setAttachedFiles([]);

    // Update the session with the rewound history
    updateSessionHistory(rewindedHistory);

    // Force refresh of StaticChatContent to show truncated history
    if (onRefreshStatic) {
      onRefreshStatic();
    }

    // Resubmit the edited message with the rewound history as the base
    // This ensures processMessage uses the correct base history
    await processMessage(newContent, undefined, false, rewindedHistory);
  };

  const handleToolPermissionResponse = async (
    requestId: string,
    approved: boolean,
    createPolicy?: boolean,
    stopStream?: boolean,
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
          currentRequest.toolArgs,
        );

        await addPolicyToYaml(policyRule);
        logger.debug(`Policy created: ${policyRule}`);

        // Reload permissions to pick up the new policy without requiring restart
        await services.toolPermissions.reloadPermissions();
      } catch (error) {
        logger.error("Failed to create policy or reload permissions", {
          error,
        });
        // Continue with the approval even if policy creation/reload fails
      }
    }

    // Send response to permission manager
    // The streamChatResponse will handle showing the appropriate message
    // through its normal onToolStart/onToolError flow
    if (approved) {
      toolPermissionManager.approveRequest(requestId);
    } else {
      toolPermissionManager.rejectRequest(requestId);

      // If this is a "stop stream" rejection, abort the current request
      if (stopStream && abortController && isWaitingForResponse) {
        abortController.abort();
        setChatHistory((prev) => [
          ...prev,
          {
            message: {
              role: "system",
              content:
                "[Tool canceled - please tell Continue what to do differently]",
            },
            contextItems: [],
          },
        ]);
        setIsWaitingForResponse(false);
        setResponseStartTime(null);
        setInputMode(true);
      }
    }
  };

  return {
    chatHistory,
    setChatHistory: setChatHistory,
    isWaitingForResponse,
    responseStartTime,
    isCompacting,
    compactionStartTime,
    inputMode,
    attachedFiles,
    activePermissionRequest,
    wasInterrupted,
    queuedMessages,
    handleUserMessage,
    handleInterrupt,
    handleFileAttached,
    resetChatHistory,
    handleEditMessage,
    handleToolPermissionResponse,
  };
}
