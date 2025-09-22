import { Text } from "ink";
import React, { useEffect, useState } from "react";

interface LoadingTextProps {
  text: string;
  color?: string;
  interval?: number;
}

export const LoadingText: React.FC<LoadingTextProps> = ({
  text,
  color = "dim",
  interval = 300,
}) => {
  const [dotsCount, setDotsCount] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setDotsCount((current) => (current % 3) + 1);
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  const dots = ".".repeat(dotsCount);

  return (
    <Text color={color}>
      {text}
      {dots}
    </Text>
  );
};
