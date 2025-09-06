import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import type { ProfileDescription } from "core/config/ConfigHandler";
import { useAppSelector } from "../../redux/hooks";
import { fontSize } from "../../util";
import { cn } from "../../util/cn";
import { ListboxButton } from "../ui";
import { AssistantIcon } from "./AssistantIcon";

interface SelectedAssistantButtonProps {
  selectedProfile: ProfileDescription | null;
  variant?: "lump" | "sidebar";
}

export function SelectedAssistantButton({
  selectedProfile,
  variant,
}: SelectedAssistantButtonProps) {
  const configLoading = useAppSelector((store) => store.config.loading);

  const isLarge = variant === "sidebar";
  const iconSize = isLarge ? "h-4 w-4" : "h-3 w-3";
  const buttonPadding = isLarge ? "px-2 py-2" : "px-0 py-0";
  const buttonStyle = isLarge ? {} : { fontSize: fontSize(-3) };

  return (
    <ListboxButton
      data-testid="assistant-select-button"
      className={`text-description border-none bg-transparent hover:brightness-125 ${isLarge ? "w-full justify-start" : "gap-1.5"} ${buttonPadding}`}
      style={buttonStyle}
    >
      <div
        className={`flex flex-row items-center ${isLarge ? "w-full justify-between" : "gap-1.5"}`}
      >
        <div className="flex flex-row items-center gap-2">
          {selectedProfile === null ? (
            "Create your first agent"
          ) : configLoading ? (
            <span className="text-description flex flex-row items-center">
              <ArrowPathIcon
                className={cn(
                  `text-description mr-1.5 ${iconSize}`,
                  configLoading && "animate-spin-slow",
                )}
              />
              Loading
            </span>
          ) : (
            <>
              <div className={`${iconSize} flex-shrink-0 select-none`}>
                <AssistantIcon assistant={selectedProfile} />
              </div>
              <span
                className={`${isLarge ? "hidden md:block" : "hidden md:block"} select-none break-words`}
              >
                {selectedProfile.title}
              </span>
            </>
          )}
        </div>
        <ChevronDownIcon
          className={`text-description ${isLarge ? "h-3.5 w-3.5" : "h-2 w-2"} ${isLarge ? "ml-1.5" : "ml-0.5"} flex-shrink-0 select-none`}
          aria-hidden="true"
        />
      </div>
    </ListboxButton>
  );
}
