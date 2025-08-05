import React, { useCallback } from "react";

import { MemoizedMessage } from "../components/MemoizedMessage.js";
import { DisplayMessage } from "../types.js";

export function useMessageRenderer() {
  const renderMessage = useCallback((message: DisplayMessage, index: number) => {
    return (
      <MemoizedMessage 
        key={index} 
        message={message} 
        index={index}
      />
    );
  }, []);

  return { renderMessage };
}
