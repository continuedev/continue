import { useEffect, useRef, useState } from "react";

export function useDebounceValue<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useDebouncedEffect(
  effect: () => void,
  delay: number,
  deps: unknown[],
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callBackRef = useRef(() => {});

  useEffect(() => {
    // do not want the timeout to reset on effect dep change
    callBackRef.current = effect;
  }, [effect]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callBackRef.current();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay, ...deps]);
}
