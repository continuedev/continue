import {
  ChatBubbleLeftIcon,
  RocketLaunchIcon,
  SparklesIcon,
  SwatchIcon,
} from "@heroicons/react/24/outline";
import { MessageModes } from "core";

interface ModeIconProps {
  mode: MessageModes;
  className?: string;
}

export function ModeIcon({
  mode,
  className = "xs:h-3 xs:w-3 h-3 w-3",
}: ModeIconProps) {
  switch (mode) {
    case "agent":
      return <SparklesIcon className={className} />;
    case "plan":
      return <SwatchIcon className={className} />;
    case "chat":
      return <ChatBubbleLeftIcon className={className} />;
    case "background":
      return <RocketLaunchIcon className={className} />;
  }
}
