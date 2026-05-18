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
  const buttonPadding = isSidebar ? "px-2 py-1.5" : "h-7 px-2";
  const buttonStyle = isSidebar ? {} : { fontSize: fontSize(-3) };
  const hoverClass = isSidebar
    ? "hover:brightness-110"
    : "hover:bg-vsc-input-background hover:brightness-150";
  const layoutClass = isSidebar ? "w-full justify-start" : "gap-1";
  const shapeClass = isSidebar ? "" : "rounded-xl";

  return (
    <ListboxButton
      data-testid="assistant-select-button"
      className={`text-description overflow-hidden border-none bg-transparent transition-colors ${hoverClass} ${shapeClass} ${layoutClass} ${buttonPadding}`}
      style={buttonStyle}
    >
      <div
        className={`flex flex-row items-center ${isSidebar ? "w-full justify-between" : "gap-1"}`}
      >
        <div className="flex min-w-0 flex-1 flex-row items-center gap-2">
          {selectedProfile === null ? (
            "Set up config file"
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
              {selectedProfile.iconUrl && (
                <AssistantIcon assistant={selectedProfile} size={iconSize} />
              )}
              <span className={`xs:line-clamp-1 hidden select-none text-xs`}>
                {selectedProfile.title}
              </span>
            </>
          )}
        </div>
        <ChevronDownIcon
          className={`text-description ml-0.5 h-3 w-3 flex-shrink-0 select-none ${isSidebar && "hidden md:block"}`}
          aria-hidden="true"
        />
      </div>
    </ListboxButton>
  );
}
