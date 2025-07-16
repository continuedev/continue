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
import { useLump } from "../mainInput/Lump/LumpContext";
import {
  Listbox,
  ListboxOption,
  ListboxOptions,
  Transition,
  useFontSize,
} from "../ui";
import { AccountOption } from "./AccountOption";
import { AssistantOptions } from "./AssistantOptions";
import { ScopeSelect } from "./ScopeSelect";
import { SelectedAssistantButton } from "./SelectedAssistantButton";

export function AssistantAndOrgListbox() {
  const dispatch = useAppDispatch();
  const listboxRef = useRef<HTMLDivElement>(null);
  const currentOrg = useAppSelector(selectCurrentOrg);
  const ideMessenger = useContext(IdeMessengerContext);
  const { isToolbarExpanded } = useLump();
  const {
    profiles,
    selectedProfile,
    session,
    login,
    organizations,
    refreshProfiles,
  } = useAuth();
  const configLoading = useAppSelector((store) => store.config.loading);
  const smallFont = useFontSize(-3);
  const tinyFont = useFontSize(-4);
  const shouldRenderOrgInfo =
    session && organizations.length > 1 && !isOnPremSession(session);

  function close() {
    // Close the listbox by clicking outside or programmatically
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);
  }

  function onNewAssistant() {
    void ideMessenger.request("controlPlane/openUrl", {
      path: "/new",
      orgSlug: currentOrg?.slug,
    });
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

  if (!selectedProfile) {
    return (
      <div
        onClick={() => {
          void ideMessenger.request("controlPlane/openUrl", {
            path: "/new?type=assistant",
            orgSlug: currentOrg?.slug,
          });
        }}
        className="text-description flex cursor-pointer select-none items-center gap-1"
        style={{ fontSize: smallFont }}
      >
        <PlusIcon className="h-3 w-3 flex-shrink-0 select-none" />
        <span
          className={`line-clamp-1 select-none break-all ${isToolbarExpanded ? "xs:hidden sm:line-clamp-1" : ""}`}
        >
          Create your first assistant
        </span>
      </div>
    );
  }

  return (
    <Listbox>
      <div className="relative" ref={listboxRef}>
        <SelectedAssistantButton selectedProfile={selectedProfile} />
        <Transition>
          <ListboxOptions className="-translate-x-1.5 pb-0">
            {shouldRenderOrgInfo && (
              <div className="border-border border-x-0 border-t-0 border-solid px-2 py-3">
                <div className="flex flex-col gap-2 pb-1 pl-1">
                  <span className="text-description-muted flex items-center pb-1">
                    {session.account.id}
                  </span>
                  <label className="text-vsc-foreground font-semibold">
                    Organization
                  </label>
                  <ScopeSelect />
                </div>
              </div>
            )}
            <AssistantOptions
              selectedProfileId={selectedProfile.id}
              onClose={close}
            />

            {/* Bottom Actions */}
            <div className="border-border border-x-0 border-b-0 border-t border-solid">
              <ListboxOption
                value="new-assistant"
                fontSizeModifier={-2}
                className="border-border border-b px-2 py-1.5"
                onClick={session ? onNewAssistant : () => login(false)}
              >
                <span
                  className="text-description flex flex-row items-center"
                  style={{ fontSize: tinyFont }}
                >
                  <PlusIcon className="mr-1 h-3 w-3" /> New Assistant
                </span>
              </ListboxOption>

              <ListboxOption
                value="reload-assistant"
                fontSizeModifier={-2}
                className="border-border border-b px-2 py-1.5"
                onClick={() => refreshProfiles()}
              >
                <span
                  className="text-description flex flex-row items-center"
                  style={{ fontSize: tinyFont }}
                >
                  <ArrowPathIcon
                    className={cn(
                      "mr-1 h-3 w-3",
                      configLoading && "animate-spin-slow",
                    )}
                  />
                  Reload config
                </span>
              </ListboxOption>

              <AccountOption onClose={close} />

              <div
                className="text-description border-border flex items-center justify-between gap-1.5 border-x-0 border-b-0 border-t border-solid px-2 py-2"
                style={{ fontSize: tinyFont }}
              >
                <span className="block" style={{ fontSize: tinyFont - 1 }}>
                  <code>{getMetaKeyLabel()} ⇧ '</code> to toggle assistant
                </span>
              </div>
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}
