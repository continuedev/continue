import { Text } from "ink";
import React, { useEffect, useState } from "react";

const SPINNER_BARS = "▁▂▃▄▅▆▇█▇▆▅▄▃▁";
const SPINNER_BLOCKS = "▉▊▋▌▍▎▏▎▍▌▋▊▉";
const SPINNER_CORNERS = "▖▘▝▗";
const SPINNER_CLASSIC = "-/|\\-/|";
const SPINNER_BOX = "┤┘┴└├┌┬┐";
const SPINNER_DOUBLE_BARS = [
  "▁▁",
  "▁▂",
  "▁▃",
  "▁▄",
  "▁▅",
  "▁▆",
  "▁▇",
  "▁█",
  "▂▇",
  "▃▆",
  "▄▅",
  "▅▄",
  "▆▃",
  "▇▂",
  "█▁",
  "▇▁",
  "▆▁",
  "▅▁",
  "▄▁",
  "▃▁",
  "▂▁",
];

const SPINNER: string | string[] = SPINNER_CORNERS;

interface LoadingAnimationProps {
  visible?: boolean;
  color?: string;
}

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  visible = true,
  color = "blue",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const animationChars =
    typeof SPINNER === "string" ? (SPINNER as string).split("") : SPINNER;

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % animationChars.length);
    }, 300);

    return () => clearInterval(interval);
  }, [visible, animationChars.length]);

  if (!visible) return null;

  return <Text color={color}>{animationChars[currentIndex]}</Text>;
};

export default LoadingAnimation;
