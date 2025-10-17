import { useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectCurrentOrg,
  setSelectedProfile,
} from "../../redux/slices/profilesSlice";
import { isMetaEquivalentKeyPressed } from "../../util";
import { CONFIG_ROUTES } from "../../util/navigation";
import { Listbox, ListboxOptions, Transition, useFontSize } from "../ui";
import { SelectedAssistantButton } from "./SelectedAssistantButton";

export interface AssistantAndOrgListboxProps {
  variant: "lump" | "sidebar";
}

export function AssistantAndOrgListbox({
  variant = "sidebar",
}: AssistantAndOrgListboxProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const listboxRef = useRef<HTMLDivElement>(null);
  const currentOrg = useAppSelector(selectCurrentOrg);
  const ideMessenger = useContext(IdeMessengerContext);
  const { profiles, selectedProfile } = useAuth();
  const tinyFont = useFontSize(-4);

  function close() {
    // Close the listbox by clicking outside or programmatically
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);
  }

  function onToolsConfig() {
    navigate(CONFIG_ROUTES.TOOLS);
    close();
  }

  useEffect(() => {
    let lastToggleTime = 0;
    const DEBOUNCE_MS = 800;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "'" &&
        isMetaEquivalentKeyPressed(event as any) &&
        event.shiftKey
      ) {
        const now = Date.now();

        if (now - lastToggleTime >= DEBOUNCE_MS) {
          lastToggleTime = now;

          const profileIds = profiles?.map((profile) => profile.id) ?? [];
          // In case of 1 or 0 profiles just does nothing
          if (profileIds.length < 2) {
            return;
          }
          let nextId = profileIds[0];
          if (selectedProfile) {
            const curIndex = profileIds.indexOf(selectedProfile.id);
            const nextIndex = (curIndex + 1) % profileIds.length;
            nextId = profileIds[nextIndex];
          }
          // Optimistic update
          dispatch(setSelectedProfile(nextId));
          ideMessenger.post("didChangeSelectedProfile", {
            id: nextId,
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentOrg, selectedProfile]);

  return (
    <Listbox>
      <div className="relative" ref={listboxRef}>
        <SelectedAssistantButton
          selectedProfile={selectedProfile}
          variant={variant}
        />
        <Transition>
          <ListboxOptions
            className="max-h-32 scale-x-[97%] overflow-y-auto pb-0"
            style={{ zIndex: 200 }}
          >
            {/* Minimal config display - no interactive options */}
            <div className="text-description flex items-center justify-start px-2 py-1">
              <span className="block text-xs" style={{ fontSize: tinyFont }}>
                AWS SDK Expert Mode
              </span>
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}
