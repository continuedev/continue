import { useEffect, useMemo, useState } from "react";
import { ChatHistoryItemWithMessageId } from "../../redux/slices/sessionSlice";

/**
 * Only reset scroll state when a new user message is added to the chat.
 * We don't want to auto-scroll on new tool response messages.
 */
function getNumUserMsgs(history: ChatHistoryItemWithMessageId[]) {
  return history.filter((msg) => msg.message.role === "user").length;
}

export const useAutoScroll = (
  ref: React.RefObject<HTMLDivElement>,
  history: ChatHistoryItemWithMessageId[],
) => {
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const numUserMsgs = useMemo(() => getNumUserMsgs(history), [history.length]);

  useEffect(() => {
    setUserHasScrolled(false);
  }, [numUserMsgs]);

  useEffect(() => {
    if (!ref.current || history.length === 0) return;

    const handleScroll = () => {
      const elem = ref.current;
      if (!elem) return;

      const isAtBottom =
        Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < 1;

      /**
       * We stop auto scrolling if a user manually scrolled up.
       * We resume auto scrolling if a user manually scrolled to the bottom.
       */
      setUserHasScrolled(!isAtBottom);
    };

    const resizeObserver = new ResizeObserver(() => {
      const elem = ref.current;
      if (!elem || userHasScrolled) return;
      elem.scrollTop = elem.scrollHeight;
    });

    // MutationObserver to watch for dynamically added components
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            // Observe the newly added element and all its descendants
            const elementsToObserve = [node, ...node.querySelectorAll("*")];
            elementsToObserve.forEach((el) => {
              resizeObserver.observe(el);
            });
          }
        });
      });
    });

    const observeAllElements = (container: Element) => {
      // Observe the container itself
      resizeObserver.observe(container);

      // Observe all existing descendants (not just direct children)
      const allElements = container.querySelectorAll("*");
      allElements.forEach((element) => {
        resizeObserver.observe(element);
      });
    };

    ref.current.addEventListener("scroll", handleScroll);

    // Observe all existing elements
    observeAllElements(ref.current);

    // Start watching for new elements
    mutationObserver.observe(ref.current, {
      childList: true,
      subtree: true, // Watch all descendants, not just direct children
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      ref.current?.removeEventListener("scroll", handleScroll);
    };
  }, [ref, history.length, userHasScrolled]);
};
