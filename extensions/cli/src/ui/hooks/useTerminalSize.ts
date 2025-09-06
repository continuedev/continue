import { useStdout } from "ink";
import { useEffect, useState } from "react";

const DEFAULT_ROWS = 24;
const DEFAULT_COLS = 80;

const useTerminalSize = (debounce = 100) => {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    columns: stdout.columns || DEFAULT_COLS,
    rows: stdout.rows || DEFAULT_ROWS,
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;

    const handleResize = () => {
      setIsResizing(true);

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        setDimensions({
          columns: stdout.columns || DEFAULT_COLS,
          rows: stdout.rows || DEFAULT_ROWS,
        });
        setIsResizing(false);
      }, debounce);
    };

    stdout.on("resize", handleResize);
    return () => {
      stdout.removeListener("resize", handleResize);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [stdout, debounce]);

  return { ...dimensions, isResizing };
};

export { useTerminalSize };
