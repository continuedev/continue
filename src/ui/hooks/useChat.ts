import { AssistantUnrolled } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { useApp } from "ink";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import path from "path";
import { useEffect, useState } from "react";
import { loadSession, saveSession } from "../../session.js";
import { handleSlashCommands } from "../../slashCommands.js";
import {
  StreamCallbacks,
  streamChatResponse,
} from "../../streamChatResponse.js";
import { constructSystemMessage } from "../../systemMessage.js";
import { getToolDisplayName } from "../../tools.js";

import { DisplayMessage } from "../types.js";

interface UseChatProps {
  assistant: AssistantUnrolled;
  model: string;
  llmApi: BaseLlmApi;
  initialPrompt?: string;
  resume?: boolean;
  onShowOrgSelector: () => void;
  onShowConfigSelector: () => void;
  onLoginPrompt?: (promptText: string) => Promise<string>;
}

export function useChat({
  assistant,
  model,
  llmApi,
  initialPrompt,
  resume,
  onShowOrgSelector,
  onShowConfigSelector,
  onLoginPrompt,
}: UseChatProps) {
  const { exit } = useApp();

  const [chatHistory, setChatHistory] = useState<ChatCompletionMessageParam[]>(
    () => {
      let history: ChatCompletionMessageParam[] = [];

      if (resume) {
        const savedHistory = loadSession();
        if (savedHistory) {
          history = savedHistory;
        }
      }

      if (history.length === 0) {
        const rulesSystemMessage = "";
        const systemMessage = constructSystemMessage(rulesSystemMessage);
        if (systemMessage) {
          history.push({ role: "system", content: systemMessage });
        }
      }

      return history;
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
  const [inputMode, setInputMode] = useState(true);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ path: string; content: string }>
  >([]);

  useEffect(() => {
    if (initialPrompt) {
      handleUserMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const handleUserMessage = async (message: string) => {
    // Special handling for /org command in TUI
    if (message.trim() === "/org") {
      onShowOrgSelector();
      return;
    }

    // Special handling for /config command in TUI
    if (message.trim() === "/config") {
      onShowConfigSelector();
      return;
    }

    // Handle slash commands
    const commandResult = await handleSlashCommands(message, assistant, onLoginPrompt);
    if (commandResult) {
      if (commandResult.exit) {
        exit();
        return;
      }

      if (commandResult.openConfigSelector) {
        onShowConfigSelector();
        return;
      }

      if (commandResult.clear) {
        const systemMessage = chatHistory.find((msg) => msg.role === "system");
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
    setInputMode(false);

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
          const formatToolCall = (name: string, args: any) => {
            const displayName = getToolDisplayName(name);
            if (!args) return displayName;

            const firstValue = Object.values(args)[0];
            const formatPath = (value: any) => {
              if (typeof value === "string" && path.isAbsolute(value)) {
                const workspaceRoot = process.cwd();
                const relativePath = path.relative(workspaceRoot, value);
                return relativePath || value;
              }
              return value;
            };

            return `${displayName}(${formatPath(firstValue) || ""})`;
          };

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
      };

      // Call streamChatResponse with the new history that includes the user message
      const finalHistory = [...newHistory];
      await streamChatResponse(
        finalHistory,
        model,
        llmApi,
        controller,
        streamCallbacks
      );

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
      
      // Save the updated history to session
      saveSession(finalHistory);
    } catch (error: any) {
      const errorMessage = `Error: ${error.message}`;
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: errorMessage,
          messageType: "system" as const,
        },
      ]);
    } finally {
      setAbortController(null);
      setIsWaitingForResponse(false);
      setInputMode(true);
    }
  };

  const handleInterrupt = () => {
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

  const resetChatHistory = () => {
    const rulesSystemMessage = "";
    const systemMessage = constructSystemMessage(rulesSystemMessage);
    const newHistory = systemMessage
      ? [{ role: "system" as const, content: systemMessage }]
      : [];
    setChatHistory(newHistory);
    setMessages([]);
  };

  return {
    messages,
    setMessages,
    chatHistory,
    setChatHistory,
    isWaitingForResponse,
    inputMode,
    attachedFiles,
    handleUserMessage,
    handleInterrupt,
    handleFileAttached,
    resetChatHistory,
  };
}