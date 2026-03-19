import {
  ArrowPathIcon,
  Cog6ToothIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setSelectedProfile } from "../../redux/slices/profilesSlice";
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../../util";
import { cn } from "../../util/cn";
import { CONFIG_ROUTES } from "../../util/navigation";
import {
  Button,
  Listbox,
  ListboxOptions,
  Transition,
  useFontSize,
} from "../ui";
import { AssistantOptions } from "./AssistantOptions";
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
  const ideMessenger = useContext(IdeMessengerContext);
  const { profiles, selectedProfile, refreshProfiles } = useAuth();
  const configLoading = useAppSelector((store) => store.config.loading);
  const tinyFont = useFontSize(-4);

  function close() {
    // Close the listbox by clicking outside or programmatically
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);
  }

  function onNewAssistant() {
    void ideMessenger.request("config/newAssistantFile", undefined);
    close();
  }

  function onConfigsConfig() {
    navigate(CONFIG_ROUTES.CONFIGS);
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
  }, [selectedProfile]);

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
            <div className="flex items-center justify-between px-1.5 py-1">
              <span className="text-description text-xs font-medium">
                Configs
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewAssistant();
                  }}
                  variant="ghost"
                  size="sm"
                  className="my-0 h-5 w-5 p-0"
                >
                  <PlusIcon className="text-description h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfigsConfig();
                  }}
                  variant="ghost"
                  size="sm"
                  className="my-0 h-5 w-5 p-0"
                >
                  <Cog6ToothIcon className="text-description h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <AssistantOptions
              selectedProfileId={selectedProfile?.id}
              onClose={close}
            />

            {/* Settings Section */}
            {variant !== "sidebar" && (
              <div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    void refreshProfiles("Manual refresh from assistant list");
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-description hover:bg-input my-0 w-full justify-start py-1.5 pl-1 text-left"
                >
                  <div className="flex w-full items-center">
                    <ArrowPathIcon
                      className={cn(
                        "ml-1.5 mr-2 h-3.5 w-3.5 flex-shrink-0",
                        configLoading && "animate-spin-slow",
                      )}
                    />
                    <span className="text-2xs">Reload</span>
                  </div>
                </Button>
              </div>
            )}

            {/* Bottom Actions */}
            <div>
              <div className="text-description flex items-center justify-start px-2 py-1">
                <span className="block" style={{ fontSize: tinyFont }}>
                  <code>{getMetaKeyLabel()} ⇧ '</code> to toggle config
                </span>
              </div>
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}
