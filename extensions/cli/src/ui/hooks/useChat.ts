import type { ChatHistoryItem, Session } from "core/index.js";
import { useApp } from "ink";
import { useEffect, useState, useRef } from "react";

import { findCompactionIndex } from "../../compaction.js";
import { toolPermissionManager } from "../../permissions/permissionManager.js";
import { ChatHistoryServiceWrapper } from "../../services/ChatHistoryServiceWrapper.js";
import { services } from "../../services/index.js";
import {
  createSession,
  loadSession,
  updateSessionHistory,
} from "../../session.js";
import { handleSlashCommands } from "../../slashCommands.js";
import { telemetryService } from "../../telemetry/telemetryService.js";
import { formatError } from "../../util/formatError.js";
import { logger } from "../../util/logger.js";

import {
  formatMessageWithFiles,
  handleAutoCompaction,
  handleCompactCommand,
  handleSpecialCommands,
  initChatHistory,
  processSlashCommandResult,
  trackUserMessage,
} from "./useChat.helpers.js";
import {
  handleRemoteMessage,
  setupRemotePolling,
} from "./useChat.remote.helpers.js";
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
  additionalRules,
  additionalPrompts,
  onShowConfigSelector,
  onShowModelSelector,
  onShowMCPSelector,
  onShowSessionSelector,
  onLoginPrompt: _onLoginPrompt,
  onClear,
  isRemoteMode = false,
  remoteUrl,
}: UseChatProps) {
  const { exit } = useApp();

  // Initialize ChatHistoryServiceWrapper for Phase 2 migration
  const wrapperRef = useRef<ChatHistoryServiceWrapper | null>(null);

  // Store the current session
  const [currentSession, setCurrentSession] = useState<Session>(() => {
    // In remote mode, start with empty session (will be populated by polling)
    if (isRemoteMode) {
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

  const [chatHistory, setChatHistoryOriginal] = useState<ChatHistoryItem[]>(
    () => currentSession.history,
  );

  // Create wrapped setChatHistory that syncs with service
  // Use a regular variable instead of ref to avoid type issues
  let setChatHistory = setChatHistoryOriginal;
  
  // Initialize wrapper on first render
  useEffect(() => {
    if (!wrapperRef.current) {
      const chatHistoryService = services.chatHistory;
      wrapperRef.current = new ChatHistoryServiceWrapper(chatHistoryService);
      
      // Initialize service with session data
      chatHistoryService.initialize(currentSession, isRemoteMode).catch((error) => {
        logger.error('Failed to initialize ChatHistoryService', { error });
      });
      
      // Create wrapped setState and setup sync
      setChatHistory = wrapperRef.current.createWrappedSetState(setChatHistoryOriginal);
      wrapperRef.current.setupSync(setChatHistoryOriginal);
      
      // Initialize service with existing state if any
      if (chatHistory.length > 0) {
        wrapperRef.current.initializeFromState(chatHistory);
      }
    }

    return () => {
      // Cleanup on unmount
      if (wrapperRef.current) {
        wrapperRef.current.cleanup();
        wrapperRef.current = null;
      }
    };
  }, []); // Run only once on mount

  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<number | null>(
    null,
  );
  const [inputMode, setInputMode] = useState(true);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [isChatHistoryInitialized, setIsChatHistoryInitialized] = useState(
    // If we're resuming and found a saved session, we're already initialized
    // If we're in remote mode, we're initialized (will be populated by polling)
    isRemoteMode || (resume && currentSession.history.length > 0),
  );

  // Capture initial rules to prevent re-initialization when rules change
  const [initialRules] = useState(additionalRules);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [activePermissionRequest, setActivePermissionRequest] =
    useState<ActivePermissionRequest | null>(null);
  const [compactionIndex, setCompactionIndex] = useState<number | null>(() => {
    // When resuming, check for compaction markers in the loaded history
    if (resume && currentSession.history.length > 0) {
      return findCompactionIndex(currentSession.history);
    }
    return null;
  });

  // Track interrupted state for resume functionality
  const [wasInterrupted, setWasInterrupted] = useState(false);

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
      setChatHistory: setChatHistory,
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
    }
  };

  const handleUserMessage = async (message: string) => {
    // Check if this is a resume request (empty message after interruption)
    if (message === "" && wasInterrupted) {
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
        return;
      }
    }

    // Clear interrupted state if user types a new message
    if (wasInterrupted && message !== "") {
      setWasInterrupted(false);
    }

    // Handle special commands
    const handled = await handleSpecialCommands({
      message,
      isRemoteMode,
      remoteUrl,
      onShowConfigSelector,
      exit,
      setChatHistory: setChatHistory,
    });

    if (handled) return;

    // Handle slash commands (skip in remote mode except for /exit which we handled above)
    if (!isRemoteMode && assistant) {
      const commandResult = await handleSlashCommands(message, assistant);
      if (commandResult) {
        if (commandResult.compact) {
          await handleCompactCommand({
            chatHistory,
            model,
            llmApi,
            setChatHistory: setChatHistory,
            setCompactionIndex,
            currentSession,
            setCurrentSession,
          });
          return;
        }

        const newInput = processSlashCommandResult({
          result: commandResult,
          chatHistory,
          setChatHistory: setChatHistory,
          exit,
          onShowConfigSelector,
          onShowModelSelector,
          onShowMCPSelector,
          onShowSessionSelector,
          onClear,
        });

        if (newInput) {
          message = newInput;
        } else {
          return;
        }
      }
    }

    // Track telemetry
    trackUserMessage(message, model);

    // Add user message to history and display
    const { messageText, contextItems } = formatMessageWithFiles(
      message,
      attachedFiles,
    );
    if (attachedFiles.length > 0) {
      setAttachedFiles([]);
    }

    // In remote mode, send message to server instead of processing locally
    if (isRemoteMode && remoteUrl) {
      await handleRemoteMessage({
        remoteUrl,
        messageContent: messageText,
        setChatHistory: setChatHistory,
      });
      return;
    }

    // Check if auto-compacting is needed BEFORE adding user message
    const { currentChatHistory, currentCompactionIndex } =
      await handleAutoCompaction({
        chatHistory,
        model,
        llmApi,
        compactionIndex,
        setChatHistory: setChatHistory,
        setCompactionIndex,
      });

    // NOW add user message to history with context items
    const newUserMessage: ChatHistoryItem = {
      message: {
        role: "user",
        content: messageText,
      },
      contextItems,
    };
    const newHistory = [...currentChatHistory, newUserMessage];
    setChatHistory(newHistory);

    // Execute the streaming response
    await executeStreamingResponse(newHistory, currentCompactionIndex);
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
        await services.mode.getToolPermissionService().reloadPermissions();
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
    inputMode,
    attachedFiles,
    activePermissionRequest,
    wasInterrupted,
    handleUserMessage,
    handleInterrupt,
    handleFileAttached,
    resetChatHistory,
    handleToolPermissionResponse,
  };
}
