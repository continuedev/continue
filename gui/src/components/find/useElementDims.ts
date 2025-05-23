import { debounce } from "lodash";
import { useEffect, useState } from "react";

export function useElementSize(
  ref: React.RefObject<HTMLElement>,
  resizeDebounce = 200,
) {
  const [size, setSize] = useState({
    height: 0,
    width: 0,
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;
    const debouncedSetSize = debounce((entries: ResizeObserverEntry[]) => {
      if (!entries.length) return;

      setIsResizing(false);
      setSize({
        height: entries[0].contentRect.height,
        width: entries[0].contentRect.width,
      });
    }, resizeDebounce);

    const resizeObserver = new ResizeObserver((entries) => {
      setIsResizing(true);
      debouncedSetSize(entries);
    });
    resizeObserver.observe(element);

    return () => {
      debouncedSetSize.cancel();
      resizeObserver.unobserve(element);
      resizeObserver.disconnect();
    };
  }, [ref, resizeDebounce]);

  return { ref, size, isResizing };
}
