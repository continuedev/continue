import { useApp } from "ink";
import { useEffect, useState } from "react";

import type { ChatHistoryItem } from "../../../../../core/index.js";
import { findCompactionIndex } from "../../compaction.js";
import { convertToUnifiedHistory, convertFromUnifiedHistory } from "../../messageConversion.js";
import { toolPermissionManager } from "../../permissions/permissionManager.js";
import { services } from "../../services/index.js";
import { loadSession, saveSession } from "../../session.js";
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

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>(
    () => {
      // In remote mode, start with empty history (will be populated by polling)
      if (isRemoteMode) {
        return [];
      }

      // Synchronously initialize chat history to prevent race conditions
      // Load previous session if resume flag is used
      // If no session loaded or not resuming, we'll need to add system message
      // We can't make this async, so we'll handle it in the useEffect
      if (resume) {
        const savedHistory = loadSession();
        if (savedHistory) {
          return convertToUnifiedHistory(savedHistory);
        }
      }
      return [];
    },
  );

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
    isRemoteMode || (resume && loadSession() !== null),
  );

  // Capture initial rules to prevent re-initialization when rules change
  const [initialRules] = useState(additionalRules);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [activePermissionRequest, setActivePermissionRequest] =
    useState<ActivePermissionRequest | null>(null);
  const [compactionIndex, setCompactionIndex] = useState<number | null>(() => {
    // When resuming, check for compaction markers in the loaded history
    if (resume) {
      const savedHistory = loadSession();
      if (savedHistory) {
        return findCompactionIndex(savedHistory);
      }
    }
    return null;
  });

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
      setChatHistory,
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
    message: string,
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
      messageLength: message.length,
      historyLength: newHistory.length,
    });

    try {
      const streamCallbacks = createStreamCallbacks(
        { setChatHistory, setActivePermissionRequest }
      );

      // Execute streaming chat response
      await executeStreaming({
        chatHistory: newHistory,
        model,
        llmApi,
        controller,
        streamCallbacks,
        currentCompactionIndex,
      });

      // Save the updated history to session
      logger.debug("Saving session", { historyLength: newHistory.length });
      const legacyHistory = convertFromUnifiedHistory(newHistory);
      saveSession(legacyHistory);
      logger.debug("Session saved");
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
    // Handle special commands
    const handled = await handleSpecialCommands({
      message,
      isRemoteMode,
      remoteUrl,
      onShowConfigSelector,
      exit,
      setChatHistory,
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
            setChatHistory,
            setCompactionIndex,
          });
          return;
        }

        const newInput = processSlashCommandResult({
          result: commandResult,
          chatHistory,
          setChatHistory,
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
    const messageContent = formatMessageWithFiles(message, attachedFiles);
    if (attachedFiles.length > 0) {
      setAttachedFiles([]);
    }

    // In remote mode, send message to server instead of processing locally
    if (isRemoteMode && remoteUrl) {
      await handleRemoteMessage({
        remoteUrl,
        messageContent,
        setChatHistory,
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
        setChatHistory,
        setCompactionIndex,
      });

    // NOW add user message to history
    const newUserMessage: ChatHistoryItem = {
      message: {
        role: "user",
        content: messageContent,
      },
      contextItems: [],
    };
    const newHistory = [...currentChatHistory, newUserMessage];
    setChatHistory(newHistory);

    // Execute the streaming response
    await executeStreamingResponse(newHistory, currentCompactionIndex, message);
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
      setChatHistory((prev) => [
        ...prev,
        {
          message: {
            role: "system",
            content: "[Interrupted by user]",
          },
          contextItems: [],
        },
      ]);
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
