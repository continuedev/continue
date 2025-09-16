import React, { useCallback } from "react";

import { LineBasedMessage } from "../components/LineBasedMessage.js";
import type { ChatHistoryLine } from "../utils/chatHistoryLineSplitter.js";

export function useLineBasedMessageRenderer() {
  const renderLineBasedMessage = useCallback(
    (item: ChatHistoryLine, index: number) => {
      // Generate a unique key using original index, line index, and content hash
      const messageContent = item.message.content;
      const contentHash = messageContent.slice(0, 50);
      const uniqueKey = `line-${item.originalIndex}-${item.lineIndex}-${contentHash}-${index}`;

      return <LineBasedMessage key={uniqueKey} item={item} index={index} />;
    },
    [],
  );

  return { renderLineBasedMessage };
}
