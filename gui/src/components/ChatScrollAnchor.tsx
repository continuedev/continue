import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { vscBackground } from ".";

interface ChatScrollAnchorProps {
  trackVisibility: boolean;
  isAtBottom: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
}

export function ChatScrollAnchor({
  trackVisibility,
  isAtBottom,
  scrollAreaRef,
}: ChatScrollAnchorProps) {
  const { ref, inView, entry } = useInView();

  useEffect(() => {
    if (isAtBottom && trackVisibility && !inView) {
      if (!scrollAreaRef.current) return;

      const scrollAreaElement = scrollAreaRef.current;

      scrollAreaElement.scrollTop =
        scrollAreaElement.scrollHeight - scrollAreaElement.clientHeight;
    }
  }, [inView, entry, isAtBottom, trackVisibility]);

  return (
    <div
      ref={ref}
      className="h-px w-full"
      style={{
        backgroundColor: vscBackground,
      }}
    />
  );
}
