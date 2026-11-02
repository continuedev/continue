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

  const isSidebar = variant === "sidebar";
  const iconSize = isSidebar ? "h-4 w-4" : "h-3 w-3";
  const buttonPadding = isSidebar ? "px-2 py-1.5" : "px-0 py-0.5";
  const buttonStyle = isSidebar ? {} : { fontSize: fontSize(-3) };

  return (
    <ListboxButton
      data-testid="assistant-select-button"
      className={`overflow-hidden border-none bg-transparent text-description hover:brightness-110 ${isSidebar ? "w-full justify-start" : "gap-1.5"} ${buttonPadding}`}
      style={buttonStyle}
    >
      <div
        className={`flex flex-row items-center ${isSidebar ? "w-full justify-between" : "gap-1.5"}`}
      >
        <div className="flex min-w-0 flex-1 flex-row items-center gap-2">
          {selectedProfile === null ? (
            "Set up config file"
          ) : configLoading ? (
            <span className="flex flex-row items-center text-description">
              <ArrowPathIcon
                className={cn(
                  `mr-1.5 text-description ${iconSize}`,
                  configLoading && "animate-spin-slow",
                )}
              />
              Loading
            </span>
          ) : (
            <>
              {selectedProfile.iconUrl && (
                <AssistantIcon assistant={selectedProfile} size={iconSize} />
              )}
              <span className={`hidden select-none text-xs xs:line-clamp-1`}>
                {selectedProfile.title}
              </span>
            </>
          )}
        </div>
        <ChevronDownIcon
          className={`ml-0.5 h-3 w-3 flex-shrink-0 select-none text-description ${isSidebar && "hidden md:block"}`}
          aria-hidden="true"
        />
      </div>
    </ListboxButton>
  );
}
