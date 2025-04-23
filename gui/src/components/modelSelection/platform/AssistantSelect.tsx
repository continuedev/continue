import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useContext, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import {
  selectCurrentOrg,
  setSelectedOrgId,
  setSelectedProfile,
} from "../../../redux";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  fontSize,
  getMetaKeyLabel,
  isLocalProfile,
  isMetaEquivalentKeyPressed,
} from "../../../util";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "../../ui";

import { ProfileDescription } from "core/config/ConfigHandler";
import { useNavigate } from "react-router-dom";
import { vscCommandCenterInactiveBorder } from "../..";
import { ROUTES } from "../../../util/navigation";
import { ToolTip } from "../../gui/Tooltip";
import { useLump } from "../../mainInput/Lump/LumpContext";
import { useFontSize } from "../../ui/font";
import AssistantIcon from "./AssistantIcon";

interface AssistantSelectOptionProps {
  profile: ProfileDescription;
  selected: boolean;
  onClick: () => void;
}

const AssistantSelectOption = ({
  profile,
  selected,
  onClick,
}: AssistantSelectOptionProps) => {
  const tinyFont = useFontSize(-4);

  const navigate = useNavigate();
  const { setSelectedSection } = useLump();

  const hasFatalErrors = useMemo(() => {
    return !!profile.errors?.find((error) => error.fatal);
  }, [profile.errors]);

  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  function handleOptionClick() {
    // optimistic update
    dispatch(setSelectedProfile(profile.id));
    // notify core which will handle actual update
    ideMessenger.post("didChangeSelectedProfile", {
      id: profile.id,
    });
    onClick();
  }

  function handleConfigure() {
    ideMessenger.post("config/openProfile", { profileId: profile.id });
    onClick();
  }

  function handleClickError() {
    if (profile.id === "local") {
      navigate(ROUTES.HOME);
      setSelectedSection("error");
    } else {
      ideMessenger.post("config/openProfile", { profileId: profile.id });
    }
    onClick();
  }

  return (
    <ListboxOption
      value={profile.id}
      disabled={hasFatalErrors}
      onClick={!hasFatalErrors ? handleOptionClick : undefined}
      fontSizeModifier={-2}
      className={selected ? "bg-list-active text-list-active-foreground" : ""}
    >
      <div
        className="flex w-full flex-col gap-0.5"
        style={{
          fontSize: tinyFont,
        }}
      >
        <div className="flex w-full items-center justify-between gap-2 bg-transparent">
          <div className="flex w-full items-center gap-1">
            <div className="flex h-4 w-4 flex-shrink-0">
              <AssistantIcon size={3.5} assistant={profile} />
            </div>
            <span
              className={`line-clamp-1 flex-1 ${selected ? "font-semibold" : ""}`}
            >
              {profile.title}
            </span>
          </div>
          <div className="flex flex-row items-center gap-1">
            {!profile.errors?.length ? (
              isLocalProfile(profile) ? (
                <Cog6ToothIcon
                  className="text-lightgray h-3 w-3 flex-shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleConfigure();
                  }}
                />
              ) : (
                <ArrowTopRightOnSquareIcon
                  className="text-lightgray h-3 w-3 flex-shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleConfigure();
                  }}
                />
              )
            ) : (
              <>
                <ExclamationTriangleIcon
                  data-tooltip-id={`${profile.id}-errors-tooltip`}
                  className="h-3 w-3 flex-shrink-0 cursor-pointer text-red-500"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClickError();
                  }}
                />
                <ToolTip id={`${profile.id}-errors-tooltip`}>
                  <div className="font-semibold">Errors</div>
                  {JSON.stringify(profile.errors, null, 2)}
                </ToolTip>
              </>
            )}
          </div>
        </div>
      </div>
    </ListboxOption>
  );
};

export default function AssistantSelect() {
  const dispatch = useAppDispatch();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { selectedProfile, refreshProfiles } = useAuth();
  const currentOrg = useAppSelector(selectCurrentOrg);
  const orgs = useAppSelector((store) => store.profiles.organizations);
  const ideMessenger = useContext(IdeMessengerContext);
  const { isToolbarExpanded } = useLump();

  const { profiles, session, login } = useAuth();
  const navigate = useNavigate();

  function close() {
    if (buttonRef.current) {
      buttonRef.current.click();
    }
  }
  function onNewAssistant() {
    ideMessenger.post("controlPlane/openUrl", {
      path: "new",
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

  const cycleOrgs = () => {
    const orgIds = orgs.map((org) => org.id);
    if (orgIds.length < 2) {
      return;
    }
    let nextId = orgIds[0];
    if (currentOrg) {
      const curIndex = orgIds.indexOf(currentOrg.id);
      const nextIndex = (curIndex + 1) % orgIds.length;
      nextId = orgIds[nextIndex];
    }
    // Optimistic update
    dispatch(setSelectedOrgId(nextId));
    ideMessenger.post("didChangeSelectedOrg", {
      id: nextId,
    });
  };

  const tinyFont = useFontSize(-4);
  const smallFont = useFontSize(-3);

  if (!selectedProfile) {
    return (
      <div
        onClick={() => {
          ideMessenger.request("controlPlane/openUrl", {
            path: "/new?type=assistant",
            orgSlug: currentOrg?.slug,
          });
        }}
        className="flex cursor-pointer select-none items-center gap-1 text-gray-400"
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
      <div className="relative">
        <ListboxButton
          data-testid="assistant-select-button"
          ref={buttonRef}
          className="border-none bg-transparent text-gray-400 hover:brightness-125"
          style={{ fontSize: fontSize(-3) }}
        >
          <div className="flex flex-row items-center gap-1.5">
            <div className="h-3 w-3 flex-shrink-0 select-none">
              <AssistantIcon size={3} assistant={selectedProfile} />
            </div>
            <span
              className={`line-clamp-1 select-none break-all ${isToolbarExpanded ? "xs:hidden sm:line-clamp-1" : ""}`}
            >
              {selectedProfile.title}
            </span>
          </div>
          <ChevronDownIcon
            className="h-2 w-2 flex-shrink-0 select-none"
            aria-hidden="true"
          />
        </ListboxButton>

        <Transition>
          <ListboxOptions className="pb-0">
            <div className="flex justify-between gap-1.5 px-2.5 py-1">
              <span>Assistants</span>
              <div
                className="flex cursor-pointer flex-row items-center gap-1 hover:brightness-125"
                onClick={(e) => {
                  e.stopPropagation();
                  refreshProfiles();
                  buttonRef.current?.click();
                }}
              >
                <ArrowPathIcon className="text-lightgray h-2.5 w-2.5" />
              </div>
            </div>

            <div
              className={`thin-scrollbar flex max-h-[300px] flex-col overflow-y-auto`}
            >
              {profiles?.map((profile, idx) => {
                return (
                  <AssistantSelectOption
                    key={idx}
                    profile={profile}
                    onClick={close}
                    selected={profile.id === selectedProfile.id}
                  />
                );
              })}
            </div>

            <div className="flex flex-col">
              <div
                className="my-0 h-[0.5px]"
                style={{
                  backgroundColor: vscCommandCenterInactiveBorder,
                }}
              />

              <div className="flex flex-row items-center">
                <ListboxOption
                  className="w-full"
                  value={"new-assistant"}
                  fontSizeModifier={-2}
                  onClick={session ? onNewAssistant : () => login(false)}
                >
                  <div
                    className="text-lightgray flex flex-row items-center gap-2"
                    style={{
                      fontSize: tinyFont,
                    }}
                  >
                    <PlusIcon className="ml-0.5 h-3 w-3 flex-shrink-0" />
                    New Assistant
                  </div>
                </ListboxOption>
              </div>

              <div
                className="my-0 h-[0.5px]"
                style={{
                  backgroundColor: vscCommandCenterInactiveBorder,
                }}
              />

              <div
                className="text-lightgray flex items-center justify-between px-2 py-1"
                style={{
                  fontSize: tinyFont,
                }}
              >
                <span
                  className="block"
                  style={{
                    fontSize: tinyFont - 1,
                  }}
                >
                  <code>{getMetaKeyLabel()} ⇧ '</code> to toggle
                </span>
                <div
                  className="ml-auto flex items-center gap-1"
                  onClick={cycleOrgs}
                >
                  {currentOrg?.iconUrl ? (
                    <img
                      src={currentOrg.iconUrl}
                      className="h-2.5 w-2.5 rounded-full"
                    />
                  ) : (
                    <BuildingOfficeIcon className="h-4 w-4" />
                  )}
                  <span
                    className="hover:cursor-pointer hover:underline"
                    style={{
                      fontSize: tinyFont - 1,
                    }}
                  >
                    {currentOrg?.name || "Personal"}
                  </span>
                </div>
              </div>
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}
