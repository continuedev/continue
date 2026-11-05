import { RefObject, useCallback, useEffect, useRef, useState } from "react";

interface ElementSize {
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  isResizing: boolean;
}

interface UseElementSizeOptions {
  debounceMs?: number;
}

export const useElementSize = (
  ref: RefObject<HTMLElement | null>,
  debounceMs = 250,
): ElementSize => {
  const [size, setSize] = useState<ElementSize>({
    clientWidth: 0,
    clientHeight: 0,
    scrollWidth: 0,
    scrollHeight: 0,
    isResizing: false,
  });

  // The pending update, so a new measurement replaces it (a real debounce)
  // and unmounting cancels it instead of setting state afterwards.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const debouncedSetSize = useCallback(
    (measurements: Omit<ElementSize, "isResizing">) => {
      setSize((prev) => ({ ...prev, isResizing: true }));

      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = undefined;
        setSize({
          ...measurements,
          isResizing: false,
        });
      }, debounceMs);
    },
    [debounceMs],
  );

  useEffect(() => {
    if (!ref.current) return;

    const updateSize = () => {
      const element = ref.current;
      if (!element) return;

      const measurements = {
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
      };

      debouncedSetSize(measurements);
    };

    // Create ResizeObserver instance
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    // Start observing the element
    resizeObserver.observe(ref.current);

    // Initial size calculation
    updateSize();

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    };
  }, [ref, debouncedSetSize]);

  return size;
};
