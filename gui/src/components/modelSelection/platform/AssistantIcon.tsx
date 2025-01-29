import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { isLocalProfile } from "../../../util";
import { ComputerDesktopIcon, SparklesIcon } from "@heroicons/react/24/outline";

export interface AssistantIconProps {
  assistant: ProfileDescription;
}

export default function AssistantIcon({ assistant }: AssistantIconProps) {
  if (isLocalProfile(assistant)) {
    return <ComputerDesktopIcon />;
  } else if (assistant.iconUrl) {
    return <img src={assistant.iconUrl} className="rounded-full" />;
  } else {
    return <SparklesIcon />;
  }
}
