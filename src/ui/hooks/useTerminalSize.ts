import { useEffect, useState } from "react";
import { useStdout } from "ink";

const useTerminalSize = (debounce = 100) => {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    columns: stdout.columns || 80,
    rows: stdout.rows || 24,
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
          columns: stdout.columns,
          rows: stdout.rows,
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
  }, [stdout]);

  return { ...dimensions, isResizing };
};

export default useTerminalSize;
