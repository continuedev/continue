import { SparklesIcon } from "@heroicons/react/24/outline";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { isLocalProfile } from "../../util";
import { BotIcon } from "../svg/BotIcon";

export interface AssistantIconProps {
  assistant: ProfileDescription;
  size?: number;
}

export function AssistantIcon({ assistant }: AssistantIconProps) {
  if (isLocalProfile(assistant)) {
    return <BotIcon className="text-foreground h-4 w-4" />;
  } else if (assistant.iconUrl) {
    return (
      <img src={assistant.iconUrl} className="h-4 w-4 rounded-full" alt="" />
    );
  } else {
    return <SparklesIcon className="h-4 w-4" />;
  }
}
