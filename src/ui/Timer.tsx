import { Text } from "ink";
import React, { useEffect, useState } from "react";

interface TimerProps {
  startTime: number;
  color?: string;
}

const Timer: React.FC<TimerProps> = ({ startTime, color = "gray" }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      setElapsed(elapsedSeconds);
    }, 100); // Update every 100ms for smooth display

    return () => clearInterval(interval);
  }, [startTime]);

  return <Text color={color}>{elapsed}s</Text>;
};

export default Timer;