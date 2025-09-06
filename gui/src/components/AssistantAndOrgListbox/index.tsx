import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import { useContext, useEffect, useRef } from "react";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectCurrentOrg,
  setSelectedProfile,
} from "../../redux/slices/profilesSlice";
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../../util";
import { cn } from "../../util/cn";
import {
  Listbox,
  ListboxOption,
  ListboxOptions,
  Transition,
  useFontSize,
} from "../ui";
import { Divider } from "../ui/Divider";
import { AssistantOptions } from "./AssistantOptions";
import { ScopeSelect } from "./ScopeSelect";
import { SelectedAssistantButton } from "./SelectedAssistantButton";

export function AssistantAndOrgListbox() {
  const dispatch = useAppDispatch();
  const listboxRef = useRef<HTMLDivElement>(null);
  const currentOrg = useAppSelector(selectCurrentOrg);
  const ideMessenger = useContext(IdeMessengerContext);
  const {
    profiles,
    selectedProfile,
    session,
    login,
    logout,
    organizations,
    refreshProfiles,
  } = useAuth();
  const configLoading = useAppSelector((store) => store.config.loading);
  const tinyFont = useFontSize(-4);
  const shouldRenderOrgInfo =
    session && organizations.length > 1 && !isOnPremSession(session);

  function close() {
    // Close the listbox by clicking outside or programmatically
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);
  }

  function onNewAssistant() {
    if (session) {
      void ideMessenger.request("controlPlane/openUrl", {
        path: "/new",
        orgSlug: currentOrg?.slug,
      });
    } else {
      void ideMessenger.request("config/newAssistantFile", undefined);
    }
    close();
  }

  function onLogout() {
    logout();
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
        <SelectedAssistantButton selectedProfile={selectedProfile} />
        <Transition>
          <ListboxOptions
            className="-translate-x-1.5 pb-0"
            style={{ zIndex: 200 }}
          >
            <div className="flex items-center justify-between p-2">
              <span className="text-description text-xs font-medium">
                Agents
              </span>
            </div>

            <AssistantOptions
              selectedProfileId={selectedProfile?.id}
              onClose={close}
            />

            {shouldRenderOrgInfo && (
              <>
                <Divider className="!mb-0.5" />
                <div className="mx-0.5">
                  {" "}
                  <ScopeSelect />
                </div>

                <Divider className="!mb-0 mt-0.5" />
              </>
            )}

            {/* Bottom Actions */}
            <div>
              <ListboxOption
                value="new-assistant"
                fontSizeModifier={-2}
                className="border-border border-b px-2 py-2"
                onClick={onNewAssistant}
              >
                <span className="text-description text-2xs flex flex-row items-center">
                  <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> New Agent
                </span>
              </ListboxOption>

              <ListboxOption
                value="reload-assistant"
                fontSizeModifier={-2}
                className="border-border border-b px-2 py-2"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  refreshProfiles("Manual refresh from assistant list");
                }}
              >
                <span className="text-description text-2xs flex flex-row items-center">
                  <ArrowPathIcon
                    className={cn(
                      "mr-1.5 h-3.5 w-3.5",
                      configLoading && "animate-spin-slow",
                    )}
                  />
                  Reload agents
                </span>
              </ListboxOption>

              <Divider className="!my-0" />

              <div className="text-description flex items-center justify-between gap-1.5 px-2 py-2">
                <span className="block" style={{ fontSize: tinyFont }}>
                  <code>{getMetaKeyLabel()} ⇧ '</code> to toggle agent
                </span>
              </div>
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}
