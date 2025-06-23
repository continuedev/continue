import { ComputerDesktopIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { isLocalProfile } from "../../util";

export interface AssistantIconProps {
  assistant: ProfileDescription;
  size?: number;
}

export function AssistantIcon({ assistant, size }: AssistantIconProps) {
  const sizeTw = size ?? 4;
  if (isLocalProfile(assistant)) {
    return (
      <div
        className={`h-${sizeTw} w-${sizeTw} bg-lightgray flex items-center justify-center rounded-full`}
      >
        <ComputerDesktopIcon
          className={`h-${sizeTw - 1} w-${sizeTw - 1} font-bold text-black`}
        />
      </div>
    );
  } else if (assistant.iconUrl) {
    return (
      <img
        src={assistant.iconUrl}
        className={`h-${sizeTw} w-${sizeTw} rounded-full`}
        alt=""
      />
    );
  } else {
    return <SparklesIcon />;
  }
}
