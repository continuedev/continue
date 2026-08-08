import { RefObject, useCallback, useEffect, useState } from "react";

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
  ref: RefObject<HTMLElement>,
  debounceMs = 250,
): ElementSize => {
  const [size, setSize] = useState<ElementSize>({
    clientWidth: 0,
    clientHeight: 0,
    scrollWidth: 0,
    scrollHeight: 0,
    isResizing: false,
  });

  // Debounced update function
  const debouncedSetSize = useCallback(
    (measurements: Omit<ElementSize, "isResizing">) => {
      let timeoutId: NodeJS.Timeout;

      setSize((prev) => ({ ...prev, isResizing: true }));

      timeoutId = setTimeout(() => {
        setSize({
          ...measurements,
          isResizing: false,
        });
      }, debounceMs);

      return () => clearTimeout(timeoutId);
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
    };
  }, [ref, debouncedSetSize]);

  return size;
};
