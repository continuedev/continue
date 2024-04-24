import { useEffect, useRef, useState } from "react";

export function useAppendedString(
  fullString: string,
  append: (chunk: string, lineCount: number) => void
) {
  // Queue of fullString updated versions to be processed atomically
  const [updateQueue, setUpdateQueue] = useState<string[]>([]);
  const lastString = useRef("");
  const processing = useRef(false);

  useEffect(() => {
    setUpdateQueue((prev) => [...prev, fullString]);
  }, [fullString]);

  useEffect(() => {
    if (updateQueue.length === 0 || processing.current) return;

    processing.current = true;
    setUpdateQueue((currentQueue) => {
      while (currentQueue.length > 0) {
        const nextString = currentQueue.shift()!;
        if (!nextString.startsWith(lastString.current)) {
          // Invalid
          continue;
        }
        const appendedPart = nextString.slice(lastString.current.length);
        lastString.current = nextString;
        append(appendedPart, lastString.current.split("\n").length);
      }
      return currentQueue;
    });
    processing.current = false;
  }, [updateQueue]);
}
