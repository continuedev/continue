import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatHistoryItemWithMessageId } from "../../redux/slices/sessionSlice";

/**
 * Reset scroll state when a new user message is added to the chat.
 * Also track tool call updates for auto-scrolling during streaming.
 */
function getNumUserMsgs(history: ChatHistoryItemWithMessageId[]) {
  return history.filter((msg) => msg.message.role === "user").length;
}

/**
 * Get a hash of tool call states to detect when tool outputs change
 */
function getToolCallHash(history: ChatHistoryItemWithMessageId[]) {
  return history
    .filter((item) => item.toolCallState)
    .map((item) => {
      const state = item.toolCallState!;
      const outputLength =
        state.output?.reduce(
          (acc, item) => acc + (item.content?.length || 0),
          0,
        ) || 0;
      return `${state.toolCallId}-${state.status}-${outputLength}`;
    })
    .join("|");
}

export const useAutoScroll = (
  ref: React.RefObject<HTMLDivElement>,
  history: ChatHistoryItemWithMessageId[],
) => {
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const numUserMsgs = useMemo(() => getNumUserMsgs(history), [history.length]);
  const toolCallHash = useMemo(() => getToolCallHash(history), [history]);

  // Reset scroll state when new user messages are added
  useEffect(() => {
    setUserHasScrolled(false);
  }, [numUserMsgs]);

  const scrollToBottom = useCallback(() => {
    const elem = ref.current;
    if (!elem) return;
    elem.scrollTop = elem.scrollHeight;
  }, [ref]);

  const handleScroll = useCallback(() => {
    const elem = ref.current;
    if (!elem) return;

    const isAtBottom =
      Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < 5;

    /**
     * We stop auto scrolling if a user manually scrolled up.
     * We resume auto scrolling if a user manually scrolled to the bottom.
     */
    setUserHasScrolled(!isAtBottom);
  }, []);
  // Auto-scroll when history changes (including tool call outputs)
  useEffect(() => {
    if (!userHasScrolled) {
      // Small delay to ensure DOM has updated
      const timeoutId = setTimeout(scrollToBottom, 10);
      return () => clearTimeout(timeoutId);
    }
  }, [history, userHasScrolled, scrollToBottom]);

  useEffect(() => {
    if (!ref.current || history.length === 0) return;

    const elem = ref.current;

    const resizeObserver = new ResizeObserver((entries) => {
      if (userHasScrolled) return;

      // Check if any observed element has grown in height
      let shouldScroll = false;
      entries.forEach((entry) => {
        const target = entry.target as HTMLElement;
        const currentHeight = entry.contentRect.height;

        // Store previous height on the element for comparison
        const prevHeight = target.dataset.prevHeight
          ? parseInt(target.dataset.prevHeight, 10)
          : 0;

        // Only scroll if the element has actually grown
        if (currentHeight > prevHeight && currentHeight > 0) {
          shouldScroll = true;
        }

        // Update stored height
        target.dataset.prevHeight = currentHeight.toString();
      });

      if (shouldScroll) {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      }
    });

    elem.addEventListener("scroll", handleScroll, { passive: true });

    // Observe the container
    resizeObserver.observe(elem);

    // Observe all immediate children and their nested content
    const observeElement = (element: Element) => {
      resizeObserver.observe(element);
      // Also observe terminal/tool output containers that can grow dynamically
      const toolElements = element.querySelectorAll(
        '[class*="terminal"], [class*="ansi"], pre, code, [class*="TerminalContainer"], [class*="AnsiWrapper"], [class*="Terminal"]',
      );
      toolElements.forEach((toolEl) => resizeObserver.observe(toolEl));
    };

    Array.from(elem.children).forEach(observeElement);

    // Set up a mutation observer to catch new elements being added
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            observeElement(node as Element);
          }
        });
      });
    });

    mutationObserver.observe(elem, {
      childList: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      elem.removeEventListener("scroll", handleScroll);
    };
  }, [ref, history.length, userHasScrolled, handleScroll, scrollToBottom]);
};
