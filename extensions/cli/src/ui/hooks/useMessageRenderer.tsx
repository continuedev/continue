import React, { useCallback } from "react";

import type { ChatHistoryItem } from "../../../../../core/index.js";
import { MemoizedMessage } from "../components/MemoizedMessage.js";

export function useMessageRenderer() {
  const renderMessage = useCallback((item: ChatHistoryItem, index: number) => {
    return <MemoizedMessage key={index} item={item} index={index} />;
  }, []);

  return { renderMessage };
}
