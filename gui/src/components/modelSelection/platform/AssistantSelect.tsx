import {
  ArrowTopRightOnSquareIcon,
  BuildingOfficeIcon,
  CheckIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useContext, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { setSelectedProfile } from "../../../redux";
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
  const navigate = useNavigate();

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
      navigate(ROUTES.CONFIG_ERROR);
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
    >
      <div className="flex w-full flex-col gap-0.5">
        <div className="flex w-full items-center justify-between">
          <div className="flex w-full items-center gap-2">
            <div className="mr-2 h-4 w-4 flex-shrink-0">
              <AssistantIcon assistant={profile} />
            </div>
            <span
              className={`line-clamp-1 flex-1 ${selected ? "font-bold" : ""}`}
            >
              {profile.title}
            </span>
          </div>
          <div className="flex flex-row items-center gap-2">
            <div>{selected ? <CheckIcon className="h-3 w-3" /> : null}</div>
            {!profile.errors?.length ? (
              isLocalProfile(profile) ? (
                <Cog6ToothIcon
                  className="h-3 w-3 flex-shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleConfigure();
                  }}
                />
              ) : (
                <ArrowTopRightOnSquareIcon
                  className="h-3 w-3 flex-shrink-0 cursor-pointer"
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
  const { selectedProfile, selectedOrganization } = useAuth();
  const availableProfiles = useAppSelector(
    (store) => store.profiles.availableProfiles,
  );
  const ideMessenger = useContext(IdeMessengerContext);
  const isLumpToolbarExpanded = useAppSelector(
    (state) => state.ui.isBlockSettingsToolbarExpanded,
  );

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
      orgSlug: selectedOrganization?.slug,
    });
    close();
  }

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
          lastToggleTime = now;

          const profileIds =
            availableProfiles?.map((profile) => profile.id) ?? [];
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
  }, [availableProfiles, selectedProfile]);

  const tinyFont = useFontSize(-4);
  const smallFont = useFontSize(-3);

  if (!selectedProfile) {
    return (
      <div
        onClick={() => {
          ideMessenger.request("controlPlane/openUrl", {
            path: "/new?type=assistant",
            orgSlug: selectedOrganization?.slug,
          });
        }}
        className="flex cursor-pointer select-none items-center gap-1 text-gray-400"
        style={{ fontSize: smallFont }}
      >
        <PlusIcon className="h-3 w-3 flex-shrink-0 select-none" />
        <span
          className={`line-clamp-1 select-none ${isLumpToolbarExpanded ? "xs:hidden sm:line-clamp-1" : ""}`}
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
              className={`line-clamp-1 select-none ${isLumpToolbarExpanded ? "xs:hidden sm:line-clamp-1" : ""}`}
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
            <div
              className={`thin-scrollbar flex max-h-[300px] flex-col gap-1 overflow-y-auto py-1`}
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

              <ListboxOption
                value={"new-assistant"}
                fontSizeModifier={-2}
                onClick={session ? onNewAssistant : () => login(false)}
              >
                <div className="flex flex-row items-center gap-2">
                  <PlusIcon className="h-4 w-4 flex-shrink-0" />
                  New Assistant
                </div>
              </ListboxOption>

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
                <span className="block">
                  <code>{getMetaKeyLabel()} ⇧ '</code> to toggle
                </span>
                <div
                  className="flex items-center gap-1"
                  onClick={() => navigate(ROUTES.CONFIG)}
                >
                  {selectedOrganization?.iconUrl ? (
                    <img
                      src={selectedOrganization.iconUrl}
                      className="h-4 w-4 rounded-full"
                    />
                  ) : (
                    <BuildingOfficeIcon className="h-4 w-4" />
                  )}
                  <span className="hover:cursor-pointer hover:underline">
                    {selectedOrganization?.name || "Personal"}
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
