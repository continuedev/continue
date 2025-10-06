import { Text } from "ink";
import React, { useEffect, useState } from "react";

interface TimerProps {
  startTime: number;
  color?: string;
}

const Timer: React.FC<TimerProps> = ({ startTime, color = "dim" }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      setElapsed(elapsedSeconds);
    }, 1000); // Update every 1000ms for efficient display

    return () => clearInterval(interval);
  }, [startTime]);

  return <Text color={color}>{elapsed}s</Text>;
};

export { Timer };
