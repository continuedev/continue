import { ComputerDesktopIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { isLocalProfile } from "../../util";

export interface AssistantIconProps {
  assistant: ProfileDescription;
  size?: string;
}

export function AssistantIcon({
  assistant,
  size = "h-4 w-4",
}: AssistantIconProps) {
  if (isLocalProfile(assistant)) {
    return (
      <ComputerDesktopIcon
        className={`text-foreground ${size} flex-shrink-0`}
      />
    );
  } else if (assistant.iconUrl) {
    return (
      <img
        src={assistant.iconUrl}
        className={`${size} flex-shrink-0 rounded-full`}
        alt=""
      />
    );
  } else {
    return <SparklesIcon className={`${size} flex-shrink-0`} />;
  }
}
