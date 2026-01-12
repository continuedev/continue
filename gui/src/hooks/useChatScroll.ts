import { RefObject, useEffect, useRef } from "react";
import { VirtuosoHandle } from "react-virtuoso";

export const useChatScroll = (
  historyLength: number,
  isStreaming: boolean,
  virtuosoRef: RefObject<VirtuosoHandle>,
) => {
  const hasInitiallyScrolled = useRef(false);

  // Force scroll to bottom on initial load
  useEffect(() => {
    if (
      historyLength > 0 &&
      virtuosoRef.current &&
      !hasInitiallyScrolled.current
    ) {
      hasInitiallyScrolled.current = true;
      // slight timeout to let virtuoso measure items
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: historyLength - 1,
          align: "end",
        });
      }, 100);
    }
  }, [historyLength, virtuosoRef.current]);

  const handleAtBottomStateChange = (isAtBottom: boolean) => {
    // No-op: we rely on isAtBottom passthrough in handleFollowOutput
  };

  const handleFollowOutput = (isAtBottom: boolean) => {
    // If we are streaming and currently at the bottom, stick to the bottom.
    // Otherwise, do not force scroll.
    return isStreaming && isAtBottom ? "auto" : false;
  };

  return {
    handleAtBottomStateChange,
    handleFollowOutput,
  };
};
