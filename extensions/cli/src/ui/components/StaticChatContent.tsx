import type { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { Box, Static, useStdout } from "ink";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { ChatHistoryItem } from "../../../../../core/index.js";
import type { MCPService } from "../../services/MCPService.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { IntroMessage } from "../IntroMessage.js";

interface StaticChatContentProps {
  showIntroMessage: boolean;
  config?: AssistantUnrolled;
  model?: ModelConfig;
  mcpService?: MCPService;
  chatHistory: ChatHistoryItem[];
  renderMessage: (item: ChatHistoryItem, index: number) => React.ReactElement;
  refreshTrigger?: number; // Add a prop to trigger refresh from parent
}

export const StaticChatContent: React.FC<StaticChatContentProps> = ({
  showIntroMessage,
  config,
  model,
  mcpService,
  chatHistory,
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
  // Only put items in pending if they contain tool calls with "calling" status
  // Everything else goes into static content
  const { staticItems, pendingItems } = React.useMemo(() => {
    const items: React.ReactElement[] = [];

    // Add intro message as first item if it should be shown
    if (showIntroMessage) {
      items.push(
        <IntroMessage
          key="intro"
          config={config}
          model={model}
          mcpService={mcpService}
        />,
      );
    }

    // Helper function to check if an item has pending tool calls
    const hasPendingToolCalls = (item: ChatHistoryItem): boolean => {
      return !!(
        item.toolCallStates &&
        item.toolCallStates.some(
          (toolState) =>
            toolState.status === "calling" ||
            toolState.status === "generating" ||
            toolState.status === "generated",
        )
      );
    };

    // Find the first message with pending tool calls from the end
    let pendingStartIndex = filteredChatHistory.length;
    for (let i = filteredChatHistory.length - 1; i >= 0; i--) {
      if (hasPendingToolCalls(filteredChatHistory[i])) {
        pendingStartIndex = i;
        // If there's a message after this one, include it too as it might be related
        if (i + 1 < filteredChatHistory.length) {
          // Keep the pending start index as is, so we include the next message
        }
        break;
      }
    }

    const stableHistory = filteredChatHistory.slice(0, pendingStartIndex);
    const pendingHistory = filteredChatHistory.slice(pendingStartIndex);

    // Add stable messages to static items
    stableHistory.forEach((item, index) => {
      items.push(renderMessage(item, index));
    });

    // Pending items will be rendered dynamically outside Static
    const pendingElements = pendingHistory.map((item, index) =>
      renderMessage(item, pendingStartIndex + index),
    );

    return {
      staticItems: items,
      pendingItems: pendingElements,
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
    </Box>
  );
};
