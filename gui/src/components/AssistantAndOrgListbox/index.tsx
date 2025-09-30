import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
  PencilIcon,
  PlusIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectCurrentOrg,
  setSelectedProfile,
} from "../../redux/slices/profilesSlice";
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
import { Divider } from "../ui/Divider";
import { AssistantOptions } from "./AssistantOptions";
import { OrganizationOptions } from "./OrganizationOptions";
import { SelectedAssistantButton } from "./SelectedAssistantButton";

export interface AssistantAndOrgListboxProps {
  variant: "lump" | "sidebar";
}

export function AssistantAndOrgListbox({
  variant = "sidebar",
}: AssistantAndOrgListboxProps) {
  const [listboxOpen, setListboxOpen] = useState(false);
  const listboxOptionsRef = useRef<HTMLUListElement>(null);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentOrg = useAppSelector(selectCurrentOrg);
  const ideMessenger = useContext(IdeMessengerContext);
  const {
    profiles,
    selectedProfile,
    session,
    logout,
    login,
    organizations,
    refreshProfiles,
  } = useAuth();
  const configLoading = useAppSelector((store) => store.config.loading);
  const tinyFont = useFontSize(-4);
  const shouldRenderOrgInfo =
    session && organizations.length > 1 && !isOnPremSession(session);

  function onNewAssistant() {
    if (session) {
      void ideMessenger.request("controlPlane/openUrl", {
        path: "/new",
        orgSlug: currentOrg?.slug,
      });
    } else {
      void ideMessenger.request("config/newAssistantFile", undefined);
    }
    setListboxOpen(false);
  }

  function onNewOrganization() {
    void ideMessenger.request("controlPlane/openUrl", {
      path: "/organizations/new",
    });
    setListboxOpen(false);
  }

  function onAgentsConfig() {
    navigate(CONFIG_ROUTES.AGENTS);
    setListboxOpen(false);
  }

  function onOrganizationsConfig() {
    navigate(CONFIG_ROUTES.ORGANIZATIONS);
    setListboxOpen(false);
  }

  function onRulesConfig() {
    navigate(CONFIG_ROUTES.RULES);
    setListboxOpen(false);
  }

  function onToolsConfig() {
    navigate(CONFIG_ROUTES.TOOLS);
    setListboxOpen(false);
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

  useClickOutside(listboxOptionsRef, () => {
    setListboxOpen(false);
  });

  return (
    <Listbox>
      <div className="relative">
        <SelectedAssistantButton
          selectedProfile={selectedProfile}
          variant={variant}
          setOptionsOpen={(val) => setListboxOpen(val)}
        />
        <Transition>
          <ListboxOptions
            className="max-h-32 scale-x-[97%] overflow-y-auto pb-0"
            style={{ zIndex: 200 }}
            static={listboxOpen}
            ref={listboxOptionsRef}
          >
            <div className="flex items-center justify-between px-1.5 py-1">
              <span className="text-description text-xs font-medium">
                Agents
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
                    onAgentsConfig();
                  }}
                  variant="ghost"
                  size="sm"
                  className="my-0 h-5 w-5 p-0"
                >
                  <Cog6ToothIcon className="text-description h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <AssistantOptions selectedProfileId={selectedProfile?.id} />

            {shouldRenderOrgInfo && (
              <>
                <Divider className="!mb-0.5 !mt-0" />
                <div className="flex items-center justify-between px-1.5 py-1">
                  <span className="text-description text-xs font-medium">
                    Organizations
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewOrganization();
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
                        onOrganizationsConfig();
                      }}
                      variant="ghost"
                      size="sm"
                      className="my-0 h-5 w-5 p-0"
                    >
                      <Cog6ToothIcon className="text-description h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <OrganizationOptions />

                <Divider className="!mb-0 mt-0.5" />
              </>
            )}

            {/* Settings Section */}
            {variant !== "sidebar" && (
              <div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRulesConfig();
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-description hover:bg-input my-0 w-full justify-start py-1.5 pl-1 text-left"
                >
                  <div className="flex w-full items-center">
                    <PencilIcon className="ml-1.5 mr-2 h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-2xs">Rules</span>
                  </div>
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToolsConfig();
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-description hover:bg-input my-0 w-full justify-start py-1.5 pl-1 text-left"
                >
                  <div className="flex w-full items-center">
                    <WrenchScrewdriverIcon className="ml-1.5 mr-2 h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-2xs">Tools</span>
                  </div>
                </Button>
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
                {session ? (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      logout();
                      setListboxOpen(false);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-description hover:bg-input my-0 w-full justify-start py-1.5 pl-1 text-left"
                  >
                    <div className="flex w-full items-center">
                      <ArrowRightStartOnRectangleIcon className="ml-1.5 mr-2 h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-2xs">Log out</span>
                    </div>
                  </Button>
                ) : (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      void login(false);
                      setListboxOpen(false);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-description hover:bg-input my-0 w-full justify-start py-1.5 pl-1 text-left"
                  >
                    <div className="flex w-full items-center">
                      <ArrowRightStartOnRectangleIcon className="ml-1.5 mr-2 h-3.5 w-3.5 flex-shrink-0 rotate-180" />
                      <span className="text-2xs">Log in</span>
                    </div>
                  </Button>
                )}

                <Divider className="!mt-0" />
              </div>
            )}

            {/* Bottom Actions */}
            <div>
              <div className="text-description flex items-center justify-start px-2 py-1">
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
