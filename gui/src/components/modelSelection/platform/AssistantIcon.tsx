import { ComputerDesktopIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { isLocalProfile } from "../../../util";

export interface AssistantIconProps {
  assistant: ProfileDescription;
}

export default function AssistantIcon({ assistant }: AssistantIconProps) {
  if (isLocalProfile(assistant)) {
    return <ComputerDesktopIcon />;
  } else if (assistant.iconUrl) {
    return <img src={assistant.iconUrl} className="h-4 w-4 rounded-full" />;
  } else {
    return <SparklesIcon />;
  }
}
