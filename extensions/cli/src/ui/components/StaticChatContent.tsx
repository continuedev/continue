import type { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { Box, Static, Text, useStdout } from "ink";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { ChatHistoryItem } from "../../../../../core/index.js";
import type { MCPService } from "../../services/MCPService.js";
import type { QueuedMessage } from "../../stream/messageQueue.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { IntroMessage } from "../IntroMessage.js";

interface StaticChatContentProps {
  showIntroMessage: boolean;
  config?: AssistantUnrolled;
  model?: ModelConfig;
  mcpService?: MCPService;
  chatHistory: ChatHistoryItem[];
  queuedMessages?: QueuedMessage[];
  renderMessage: (item: ChatHistoryItem, index: number) => React.ReactElement;
  refreshTrigger?: number; // Add a prop to trigger refresh from parent
}

export const StaticChatContent: React.FC<StaticChatContentProps> = ({
  showIntroMessage,
  config,
  model,
  mcpService,
  chatHistory,
  queuedMessages = [],
  renderMessage,
  refreshTrigger,
}) => {
  const { columns, rows } = useTerminalSize();
  const { stdout } = useStdout();

  // State for managing static refresh with key-based remounting (gemini-cli approach)
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

  // Filter out system messages without content
  const filteredChatHistory = React.useMemo(() => {
    return chatHistory.filter(
      (item) => item.message.role !== "system" || item.message.content,
    );
  }, [chatHistory]);

  // Split chat history into stable and pending items
  // The last two items may have pending tool calls
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
        />,
      );
    }

    const PENDING_ITEMS_COUNT = 2;
    const stableCount = Math.max(
      0,
      filteredChatHistory.length - PENDING_ITEMS_COUNT,
    );
    const stableHistory = filteredChatHistory.slice(0, stableCount);
    const pendingHistory = filteredChatHistory.slice(stableCount);

    // Add stable messages to static items
    stableHistory.forEach((item, index) => {
      staticItems.push(renderMessage(item, index));
    });

    // Pending items will be rendered dynamically outside Static
    const pendingItems = pendingHistory.map((item, index) =>
      renderMessage(item, stableCount + index),
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
    filteredChatHistory,
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
          <Text color="gray" italic>
            {queuedMessages.map((msg) => msg.message).join("\n")}
          </Text>
        </Box>
      )}
    </Box>
  );
};
