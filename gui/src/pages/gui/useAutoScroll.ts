import { useEffect, useState } from "react";
import { ChatHistoryItemWithMessageId } from "../../redux/slices/sessionSlice";

export const useAutoScroll = (
  ref: React.RefObject<HTMLDivElement>,
  history: ChatHistoryItemWithMessageId[],
) => {
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [numUserMsgs, setNumUserMsgs] = useState(0);

  useEffect(() => {
    const newNumUserMsgs = history.filter(
      (msg) => msg.message.role === "user",
    ).length;

    if (newNumUserMsgs > numUserMsgs) {
      setUserHasScrolled(false);
    }

    setNumUserMsgs(newNumUserMsgs);
  }, [history.length]);

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

    ref.current.addEventListener("scroll", handleScroll);

    // Observe the container
    resizeObserver.observe(ref.current);

    // Observe all immediate children
    Array.from(ref.current.children).forEach((child) => {
      resizeObserver.observe(child);
    });

    return () => {
      resizeObserver.disconnect();
      ref.current?.removeEventListener("scroll", handleScroll);
    };
  }, [ref, history.length, userHasScrolled]);
};
