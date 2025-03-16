import { Popover } from "@headlessui/react";
import { ChevronDownIcon, PlusIcon } from "@heroicons/react/24/outline";
import { ProfileDescription } from "core/config/ConfigHandler";
import { useContext, useEffect, useRef } from "react";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch } from "../../../redux/hooks";
import { cycleProfile } from "../../../redux/thunks/profileAndOrg";
import { getFontSize, isMetaEquivalentKeyPressed } from "../../../util";
import PopoverTransition from "../../mainInput/InputToolbar/PopoverTransition";
import AssistantIcon from "./AssistantIcon";
import { AssistantSelectOptions } from "./AssistantSelectOptions";

function AssistantSelectButton(props: { selectedProfile: ProfileDescription }) {
  return (
    <div className="flex max-w-[50vw] items-center gap-0.5">
      <div className="mr-1 h-4 w-4 flex-shrink-0">
        <AssistantIcon assistant={props.selectedProfile} />
      </div>
      <span className="truncate">{props.selectedProfile.title}</span>
      <ChevronDownIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
    </div>
  );
}

export default function AssistantSelect() {
  const dispatch = useAppDispatch();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { selectedProfile, selectedOrganization } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);

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
    return (
      <div
        onClick={() => {
          ideMessenger.request("controlPlane/openUrl", {
            path: "/new?type=assistant",
            orgSlug: selectedOrganization?.slug,
          });
        }}
        className="text-lightgray hover:bg mb-1 mr-3 flex cursor-pointer items-center gap-1"
        style={{ fontSize: `${getFontSize() - 2}px` }}
      >
        <PlusIcon className="h-4 w-4" /> Create your first assistant
      </div>
    );
  }

  return (
    <Popover>
      <div className="relative">
        <Popover.Button
          data-testid="assistant-select-button"
          ref={buttonRef}
          className="text-lightgray cursor-pointer border-none bg-transparent hover:brightness-125"
          style={{ fontSize: `${getFontSize() - 2}px` }}
        >
          <AssistantSelectButton selectedProfile={selectedProfile} />
        </Popover.Button>

        <PopoverTransition>
          <Popover.Panel className="bg-vsc-input-background absolute right-0 top-full z-[1000] mr-1 mt-1 flex min-w-[200px] max-w-[90vw] cursor-default flex-row overflow-hidden rounded-md border-2 border-zinc-600 p-0">
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
