import type { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { Box, Static, Text, useStdout } from "ink";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ChatHistoryItem } from "../../../../../core/index.js";
import type { MCPService } from "../../services/MCPService.js";
import type { QueuedMessage } from "../../stream/messageQueue.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { useLineBasedMessageRenderer } from "../hooks/useLineBasedMessageRenderer.js";
import { IntroMessage } from "../IntroMessage.js";
import {
  splitChatHistoryIntoLines,
  ChatHistoryLine,
} from "../utils/chatHistoryLineSplitter.js";

interface StaticChatContentProps {
  showIntroMessage: boolean;
  config?: AssistantUnrolled;
  model?: ModelConfig;
  mcpService?: MCPService;
  chatHistory: ChatHistoryItem[];
  queuedMessages?: QueuedMessage[];
  renderMessage: (item: ChatHistoryItem, index: number) => React.ReactElement; // Keep for compatibility but won't use
  refreshTrigger?: number;
}

export const StaticChatContent: React.FC<StaticChatContentProps> = ({
  showIntroMessage,
  config,
  model,
  mcpService,
  chatHistory,
  queuedMessages = [],
  renderMessage, // Keep for compatibility but won't use
  refreshTrigger,
}) => {
  const { columns, rows } = useTerminalSize();
  const { stdout } = useStdout();
  const { renderLineBasedMessage } = useLineBasedMessageRenderer();

  // State for managing static refresh with key-based remounting
  const [staticKey, setStaticKey] = useState(0);
  const [lineChatHistory, setLineChatHistory] = useState<ChatHistoryLine[]>([]);
  const isInitialMount = useRef(true);

  // Refresh function that clears terminal and remounts Static component
  const refreshStatic = useCallback(() => {
    stdout.write("\x1b[2J\x1b[H");
    setStaticKey((prev) => prev + 1);
    stdout.write("\x1b[3J");
  }, [stdout]);

  // Convert chat history to line-based format
  useEffect(() => {
    let isCancelled = false;

    const convertToLines = async () => {
      try {
        // Filter out system messages without content
        const filteredChatHistory = chatHistory.filter(
          (item) => item.message.role !== "system" || item.message.content,
        );

        // Only process if we have new content
        if (filteredChatHistory.length === 0) {
          setLineChatHistory([]);
          return;
        }

        const lines = await splitChatHistoryIntoLines(
          filteredChatHistory,
          columns,
        );

        if (!isCancelled) {
          setLineChatHistory(lines);
        }
      } catch (error) {
        console.error("Failed to convert chat history to lines:", error);
        if (!isCancelled) {
          setLineChatHistory([]);
        }
      }
    };

    convertToLines();

    return () => {
      isCancelled = true;
    };
  }, [chatHistory, columns]);

  // Debounced terminal resize handler
  useEffect(() => {
    // Skip refreshing Static during first mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Debounce so it doesn't fire too often during resize
    const handler = setTimeout(() => {
      refreshStatic();
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [columns, rows, refreshStatic]);

  // Trigger refresh when refreshTrigger prop changes (for /clear command)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refreshStatic();
    }
  }, [refreshTrigger, refreshStatic]);

  // Split into stable and pending items
  const { staticItems, pendingItems } = useMemo(() => {
    const staticItems: React.ReactElement[] = [];

    // Add intro message if it should be shown
    if (showIntroMessage) {
      staticItems.push(
        <IntroMessage
          key="intro"
          config={config}
          model={model}
          mcpService={mcpService}
        />,
      );
    }

    // Remove processing indicator to prevent screen clearing
    // if (isProcessingLines) {
    //   staticItems.push(
    //     <Box key="processing" paddingLeft={2}>
    //       <Text color="gray" italic>Processing chat history...</Text>
    //     </Box>
    //   );
    //   return { staticItems, pendingItems: [] };
    // }

    const PENDING_ITEMS_COUNT = 1;
    const stableCount = Math.max(
      0,
      lineChatHistory.length - PENDING_ITEMS_COUNT,
    );

    // Add stable messages to static items
    const stableHistory = lineChatHistory.slice(0, stableCount);
    stableHistory.forEach((item, index) => {
      staticItems.push(renderLineBasedMessage(item, index));
    });

    const pendingHistory = lineChatHistory.slice(stableCount);
    const pendingItems = pendingHistory.map((item, index) =>
      renderLineBasedMessage(item, stableCount + index),
    );

    return { staticItems, pendingItems };
  }, [
    showIntroMessage,
    config,
    model,
    mcpService,
    lineChatHistory,
    renderLineBasedMessage,
  ]);

  return (
    <Box flexDirection="column">
      {/* Static content - items that won't change */}
      <Static
        key={staticKey}
        items={staticItems}
        style={{
          width: columns - 1,
          textWrap: "wrap",
        }}
      >
        {(item) => item}
      </Static>

      {/* Pending area - dynamically rendered items that can update */}
      <Box flexDirection="column">
        {pendingItems.map((item, index) => (
          <React.Fragment key={`pending-${index}`}>{item}</React.Fragment>
        ))}
      </Box>

      {/* Queued messages - show at bottom with queue indicators */}
      {queuedMessages.length > 0 && (
        <Box paddingLeft={2} paddingBottom={1}>
          <Text color="gray" italic>
            {queuedMessages.map((msg) => msg.message).join("\n")}
          </Text>
        </Box>
      )}
    </Box>
  );
};
