import { Text } from "ink";
import React, { useEffect, useState } from "react";

interface LoadingAnimationProps {
  visible?: boolean;
  color?: string;
}

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  visible = true,
  color = "gray",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const animationChars = ["-", "/", "|", "\\", "-", "/"];

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % animationChars.length);
    }, 150);

    return () => clearInterval(interval);
  }, [visible, animationChars.length]);

  if (!visible) return null;

  return <Text color={color}>{animationChars[currentIndex]}</Text>;
};

export default LoadingAnimation;
