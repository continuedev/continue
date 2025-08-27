import React, { useCallback } from "react";

import type { ChatHistoryItem } from "../../../../../core/index.js";
import { MemoizedMessage } from "../components/MemoizedMessage.js";

export function useMessageRenderer() {
  const renderMessage = useCallback((item: ChatHistoryItem, index: number) => {
    // Generate a unique key by combining message role, content hash, and timestamp
    // This provides a stable identifier that won't change during re-renders
    const messageContent =
      typeof item.message.content === "string"
        ? item.message.content
        : JSON.stringify(item.message.content);

    const toolCallsKey = item.toolCallStates
      ? item.toolCallStates.map((tc) => tc.toolCallId).join("-")
      : "";

    const uniqueKey = `${item.message.role}-${messageContent.slice(0, 50)}-${toolCallsKey}-${index}`;

    return <MemoizedMessage key={uniqueKey} item={item} index={index} />;
  }, []);

  return { renderMessage };
}
