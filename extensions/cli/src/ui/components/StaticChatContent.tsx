import type { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { Box, Static, Text, useStdout } from "ink";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { ChatHistoryItem } from "../../../../../core/index.js";
import type { MCPService } from "../../services/MCPService.js";
import type { QueuedMessage } from "../../stream/messageQueue.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { IntroMessage } from "../IntroMessage.js";
import { splitChatHistory } from "../utils/historySplitting.js";

interface StaticChatContentProps {
  showIntroMessage: boolean;
  config?: AssistantUnrolled;
  model?: ModelConfig;
  mcpService?: MCPService;
  organizationName?: string;
  chatHistory: ChatHistoryItem[];
  queuedMessages?: QueuedMessage[];
  renderMessage: (
    item: ChatHistoryItem,
    index: number,
    allMessages?: ChatHistoryItem[],
  ) => React.ReactElement;
  refreshTrigger?: number;
}

export const StaticChatContent: React.FC<StaticChatContentProps> = ({
  showIntroMessage,
  config,
  model,
  mcpService,
  organizationName,
  chatHistory,
  queuedMessages = [],
  renderMessage,
  refreshTrigger,
}) => {
  const { columns, rows } = useTerminalSize();
  const { stdout } = useStdout();

  // State for managing static refresh with key-based remounting
  const [staticKey, setStaticKey] = useState(0);
  const isInitialMount = useRef(true);

  // Refresh function that clears terminal and remounts Static component
  const refreshStatic = useCallback(() => {
    // Clear terminal completely including scrollback buffer (3J)
    stdout.write("\x1b[2J\x1b[H");
    setStaticKey((prev) => prev + 1);
    stdout.write("\x1b[3J");
  }, [stdout]);

  // Debounced terminal resize handler (300ms like gemini-cli)
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

  // Filter out system messages without content and split large messages
  const processedChatHistory = React.useMemo(() => {
    const filtered = chatHistory.filter(
      (item) => item.message.role !== "system" || item.message.content,
    );

    // Split large messages into multiple history items
    return splitChatHistory(filtered, columns);
  }, [chatHistory, columns]);

  // Split chat history into stable and pending items
  // Keep more items static now that we've split large messages
  const { staticItems, pendingItems } = React.useMemo(() => {
    // Add intro message as first item if it should be shown
    const staticItems: React.ReactElement[] = [];
    if (showIntroMessage) {
      staticItems.push(
        <IntroMessage
          key="intro"
          config={config}
          model={model}
          mcpService={mcpService}
          organizationName={organizationName}
        />,
      );
    }

    // Since messages are now split into reasonably-sized chunks,
    // we can keep more items static (only last 1-2 items dynamic)
    const PENDING_ITEMS_COUNT = 1;
    const stableCount = Math.max(
      0,
      processedChatHistory.length - PENDING_ITEMS_COUNT,
    );
    const stableHistory = processedChatHistory.slice(0, stableCount);
    const pendingHistory = processedChatHistory.slice(stableCount);

    // Add stable messages to static items
    stableHistory.forEach((item, index) => {
      staticItems.push(renderMessage(item, index, processedChatHistory));
    });

    // Pending items will be rendered dynamically outside Static
    const pendingItems = pendingHistory.map((item, index) =>
      renderMessage(item, stableCount + index, processedChatHistory),
    );

    return {
      staticItems,
      pendingItems,
    };
  }, [
    showIntroMessage,
    config,
    model,
    mcpService,
    organizationName,
    processedChatHistory,
    renderMessage,
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
          <Text color="dim" italic>
            {queuedMessages.map((msg) => msg.message).join("\n")}
          </Text>
        </Box>
      )}
    </Box>
  );
};
