import {
  CheckIcon,
  EllipsisHorizontalIcon,
  StopCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { LLMInteraction } from "../../hooks/useLLMLog";

export interface StatusIconProps {
  interaction: LLMInteraction;
}

export default function StatusIcon({ interaction }: StatusIconProps) {
  if (interaction.end) {
    switch (interaction.end.kind) {
      case "success":
        return (
          <CheckIcon className="relative top-[2px] -mt-[2px] h-[16px] w-[16px] pr-[2px] text-[color:var(--vscode-charts-green)]" />
        );
      case "cancel":
        return (
          <StopCircleIcon className="relative top-[2px] -mt-[2px] h-[16px] w-[16px] pr-[2px] text-[color:var(--vscode-list-warningForeground)]" />
        );
      case "error":
        return (
          <XCircleIcon className="relative top-[2px] -mt-[2px] h-[16px] w-[16px] pr-[2px] text-[color:var(--vscode-list-errorForeground)]" />
        );
    }
  } else {
    return (
      <EllipsisHorizontalIcon className="relative top-[2px] -mt-[2px] h-[16px] w-[16px] pr-[2px]" />
    );
  }
}
