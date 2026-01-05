import { RefObject, useEffect, useRef } from "react";
import { VirtuosoHandle } from "react-virtuoso";

export const useChatScroll = (
  historyLength: number,
  isStreaming: boolean,
  virtuosoRef: RefObject<VirtuosoHandle>,
) => {
  const shouldAutoScroll = useRef(true);

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
    shouldAutoScroll.current = isAtBottom;
  };

  const handleFollowOutput = (isAtBottom: boolean) => {
    const should = isStreaming && shouldAutoScroll.current;

    // Simplified logic: If we intend to autoscroll (shouldAutoScroll) and are streaming, do it.
    // relying on Virtuoso's state tracking for shouldAutoScroll.
    if (should) {
      return "auto";
    }
    return false;
  };

  return {
    handleAtBottomStateChange,
    handleFollowOutput,
  };
};
