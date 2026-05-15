import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const hasRunInitialScroll = useRef(false);
  const userHasScrolledRef = useRef(false);
  const hasUserInteractedWithScrollRef = useRef(false);
  const initialStickToBottomRef = useRef(false);
  const initialRafIdsRef = useRef<number[]>([]);
  const initialTimeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const numUserMsgs = useMemo(() => getNumUserMsgs(history), [history]);

  const clearInitialScrollTimers = useCallback(() => {
    initialRafIdsRef.current.forEach((id) => cancelAnimationFrame(id));
    initialRafIdsRef.current = [];

    initialTimeoutIdsRef.current.forEach((id) => clearTimeout(id));
    initialTimeoutIdsRef.current = [];
  }, []);

  useEffect(() => {
    userHasScrolledRef.current = userHasScrolled;
  }, [userHasScrolled]);

  const scrollToBottomIncludingScrollableAncestors = useCallback(() => {
    const elem = ref.current;
    if (!elem) return;

    elem.scrollTop = elem.scrollHeight;

    let parent = elem.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      const canScrollY =
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        parent.scrollHeight > parent.clientHeight;

      if (canScrollY) {
        parent.scrollTop = parent.scrollHeight;
      }

      parent = parent.parentElement;
    }
  }, [ref]);

  // Guaranteed initial scroll on reload/mount so chat opens at the latest message.
  useEffect(() => {
    if (!ref.current || history.length === 0 || hasRunInitialScroll.current) {
      return;
    }

    clearInitialScrollTimers();

    hasRunInitialScroll.current = true;
    setUserHasScrolled(false);
    initialStickToBottomRef.current = true;

    const scheduleRaf = (callback: FrameRequestCallback) => {
      const id = requestAnimationFrame(callback);
      initialRafIdsRef.current.push(id);
      return id;
    };

    const scheduleTimeout = (callback: () => void, delayMs: number) => {
      const id = setTimeout(callback, delayMs);
      initialTimeoutIdsRef.current.push(id);
      return id;
    };

    const scrollToBottom = () => {
      scrollToBottomIncludingScrollableAncestors();
    };

    // Multiple passes handle delayed layout during session hydration.
    scrollToBottom();
    scheduleRaf(() => {
      scrollToBottom();
    });
    scheduleRaf(() => {
      scrollToBottom();
    });
    scheduleTimeout(scrollToBottom, 80);

    // Keep the latest message pinned for a short hydration window.
    const stickUntil = Date.now() + 5000;

    const stickToBottom = () => {
      if (!initialStickToBottomRef.current) return;
      if (userHasScrolledRef.current) {
        initialStickToBottomRef.current = false;
        return;
      }

      scrollToBottom();

      if (Date.now() < stickUntil) {
        scheduleRaf(stickToBottom);
      } else {
        initialStickToBottomRef.current = false;
      }
    };

    scheduleRaf(stickToBottom);
  }, [
    clearInitialScrollTimers,
    ref,
    history.length,
    scrollToBottomIncludingScrollableAncestors,
  ]);

  useEffect(() => {
    if (history.length === 0) {
      hasRunInitialScroll.current = false;
      initialStickToBottomRef.current = false;
      hasUserInteractedWithScrollRef.current = false;
      clearInitialScrollTimers();
    }
  }, [clearInitialScrollTimers, history.length]);

  // Scroll to latest content by default unless the user manually moved away.
  useEffect(() => {
    if (!ref.current || history.length === 0 || userHasScrolled) return;

    const scrollToBottom = () => {
      scrollToBottomIncludingScrollableAncestors();
    };

    // First pass for already-laid-out content.
    scrollToBottom();

    // Follow-up passes for content that settles after initial paint.
    const rafId = requestAnimationFrame(() => {
      scrollToBottom();
    });
    const timeoutId = setTimeout(scrollToBottom, 40);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [
    ref,
    history,
    scrollToBottomIncludingScrollableAncestors,
    userHasScrolled,
  ]);

  useEffect(() => {
    setUserHasScrolled(false);
    hasUserInteractedWithScrollRef.current = false;
  }, [numUserMsgs]);

  useEffect(() => {
    if (!ref.current || history.length === 0) return;

    const markUserInteracted = () => {
      hasUserInteractedWithScrollRef.current = true;
    };

    const handleScroll = () => {
      const elem = ref.current;
      if (!elem) return;

      if (initialStickToBottomRef.current) {
        return;
      }

      // Ignore non-user scroll changes during hydration/layout.
      if (!hasUserInteractedWithScrollRef.current) {
        setUserHasScrolled(false);
        return;
      }

      const distanceFromBottom =
        elem.scrollHeight - elem.scrollTop - elem.clientHeight;
      const isAtBottom = distanceFromBottom <= 24;

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

    ref.current.addEventListener("scroll", handleScroll);
    ref.current.addEventListener("wheel", markUserInteracted, {
      passive: true,
    });
    ref.current.addEventListener("touchstart", markUserInteracted, {
      passive: true,
    });
    ref.current.addEventListener("pointerdown", markUserInteracted);

    // Observe the container
    resizeObserver.observe(ref.current);

    // Observe all immediate children
    Array.from(ref.current.children).forEach((child) => {
      resizeObserver.observe(child);
    });

    return () => {
      resizeObserver.disconnect();
      ref.current?.removeEventListener("scroll", handleScroll);
      ref.current?.removeEventListener("wheel", markUserInteracted);
      ref.current?.removeEventListener("touchstart", markUserInteracted);
      ref.current?.removeEventListener("pointerdown", markUserInteracted);
    };
  }, [ref, history, userHasScrolled]);
};
