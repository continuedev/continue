import { Popover } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef } from "react";
import { useAuth } from "../../../context/Auth";
import { useAppDispatch } from "../../../redux/hooks";
import { cycleProfile } from "../../../redux/thunks/cycleProfile";
import {
  getFontSize,
  isLocalProfile,
  isMetaEquivalentKeyPressed,
} from "../../../util";
import PopoverTransition from "../../mainInput/InputToolbar/PopoverTransition";
import { AssistantSelectOptions } from "./AssistantSelectOptions";
import AssistantIcon from "./AssistantIcon";
import { getProfileDisplayText } from "./utils";

export default function AssistantSelect() {
  const dispatch = useAppDispatch();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { selectedProfile } = useAuth();

  const isLocalProfileSelected =
    selectedProfile && isLocalProfile(selectedProfile);

  useEffect(() => {
    let lastToggleTime = 0;
    const DEBOUNCE_MS = 500;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "'" &&
        isMetaEquivalentKeyPressed(event as any) &&
        event.shiftKey
      ) {
        const now = Date.now();

        if (now - lastToggleTime >= DEBOUNCE_MS) {
          dispatch(cycleProfile());
          lastToggleTime = now;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!selectedProfile) {
    return null;
  }

  return (
    <Popover>
      <div className="relative">
        <Popover.Button
          data-testid="assistant-select-button"
          ref={buttonRef}
          className="text-vsc-foreground-muted cursor-pointer border-none bg-transparent text-gray-500 hover:brightness-125"
          style={{ fontSize: `${getFontSize() - 2}px` }}
        >
          <div className="flex max-w-[50vw] items-center gap-0.5">
            <div className="mr-1 h-4 w-4 flex-shrink-0">
              <AssistantIcon assistant={selectedProfile} />
            </div>
            <span className="truncate">
              {getProfileDisplayText(selectedProfile)}
            </span>
            <ChevronDownIcon
              className="h-3 w-3 flex-shrink-0"
              aria-hidden="true"
            />
          </div>
        </Popover.Button>

        <PopoverTransition>
          <Popover.Panel className="bg-vsc-input-background absolute right-0 top-full z-[1000] mr-1 mt-1 flex max-w-[90vw] cursor-default flex-row overflow-hidden rounded-md border border-gray-400 p-0">
            <AssistantSelectOptions
              onClose={() => {
                if (buttonRef.current) {
                  buttonRef.current.click();
                }
              }}
            />
          </Popover.Panel>
        </PopoverTransition>
      </div>
    </Popover>
  );
}
