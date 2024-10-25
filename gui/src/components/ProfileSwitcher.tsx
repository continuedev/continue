import { Listbox, Transition } from "@headlessui/react";
import {
  ChevronUpDownIcon,
  UserCircleIcon as UserCircleIconOutline,
} from "@heroicons/react/24/outline";
import { UserCircleIcon as UserCircleIconSolid } from "@heroicons/react/24/solid";
import { ProfileDescription } from "core/config/ConfigHandler";
import { Fragment, useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscForeground,
  vscInputBackground,
  vscListActiveBackground,
  vscListActiveForeground,
} from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAuth } from "../hooks/useAuth";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { setLastControlServerBetaEnabledStatus } from "../redux/slices/miscSlice";
import { RootState } from "../redux/store";
import { getFontSize } from "../util";
import ButtonWithTooltip from "./ButtonWithTooltip";

const StyledListbox = styled(Listbox)`
  background-color: ${vscBackground};
  min-width: 80px;
`;

const StyledListboxButton = styled(Listbox.Button)`
  position: relative;
  cursor: pointer;
  background-color: ${vscBackground};
  text-align: left;
  border: none;
  margin: 0;
  height: 100%;
  width: 100%;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;

  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};

  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;

  color: ${vscForeground};

  padding: 3px 6px;

  &:focus {
    outline: none;
  }

  &:hover {
    background-color: ${vscInputBackground};
  }

  font-size: ${getFontSize() - 2}px;
`;

const StyledListboxOptions = styled(Listbox.Options)`
  background-color: ${vscInputBackground};
  padding: 0;

  position: absolute;
  bottom: calc(100% - 16px);
  max-width: 100%;
  max-height: 80vh;

  border-radius: ${defaultBorderRadius};
  overflow-y: scroll;
`;

const StyledListboxOption = styled(Listbox.Option)<{ selected: boolean }>`
  background-color: ${({ selected }) =>
    selected ? vscListActiveBackground : vscInputBackground};
  cursor: pointer;
  padding: 6px 8px;

  &:hover {
    background-color: ${vscListActiveBackground};
    color: ${vscListActiveForeground};
  }
`;

function ListBoxOption({
  option,
  idx,
  showDelete,
  selected,
}: {
  option: ProfileDescription;
  idx: number;
  showDelete?: boolean;
  selected: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <StyledListboxOption
      key={idx}
      selected={selected}
      value={option.id}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      <div className="relative flex h-5 items-center justify-between gap-3">
        {option.title}
      </div>
    </StyledListboxOption>
  );
}

function ProfileSwitcher() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { session, logout, login } = useAuth();
  const [profiles, setProfiles] = useState<ProfileDescription[]>([]);

  const dispatch = useDispatch();
  const lastControlServerBetaEnabledStatus = useSelector(
    (state: RootState) => state.misc.lastControlServerBetaEnabledStatus,
  );

  const selectedProfileId = useSelector(
    (store: RootState) => store.state.selectedProfileId,
  );

  const [controlServerBetaEnabled, setControlServerBetaEnabled] =
    useState(false);

  useEffect(() => {
    ideMessenger.ide.getIdeSettings().then(({ enableControlServerBeta }) => {
      setControlServerBetaEnabled(enableControlServerBeta);
      dispatch(setLastControlServerBetaEnabledStatus(enableControlServerBeta));

      const shouldShowPopup =
        !lastControlServerBetaEnabledStatus && enableControlServerBeta;
      if (shouldShowPopup) {
        ideMessenger.ide.showToast("info", "Continue for Teams enabled");
      }
    });
  }, []);

  useWebviewListener(
    "didChangeIdeSettings",
    async (msg) => {
      const { settings } = msg;
      setControlServerBetaEnabled(settings.enableControlServerBeta);
      dispatch(
        setLastControlServerBetaEnabledStatus(settings.enableControlServerBeta),
      );
    },
    [],
  );

  useEffect(() => {
    ideMessenger
      .request("config/listProfiles", undefined)
      .then(
        (result) => result.status === "success" && setProfiles(result.content),
      );
  }, []);

  useWebviewListener(
    "didChangeAvailableProfiles",
    async (data) => {
      setProfiles(data.profiles);
    },
    [],
  );

  const topDiv = document.getElementById("profile-select-top-div");

  function selectedProfile() {
    return profiles.find((p) => p.id === selectedProfileId);
  }

  return (
    <>
      {controlServerBetaEnabled && session?.account?.id && (
        <StyledListbox
          value={"GPT-4"}
          onChange={(id: string) => {
            ideMessenger.request("didChangeSelectedProfile", { id });
          }}
        >
          <div className="relative">
            <StyledListboxButton>
              <span className="truncate">{selectedProfile()?.title}</span>
              <div className="pointer-events-none flex items-center">
                <ChevronUpDownIcon
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
              </div>
            </StyledListboxButton>
            {topDiv &&
              ReactDOM.createPortal(
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <StyledListboxOptions>
                    {profiles.map((option, idx) => (
                      <ListBoxOption
                        selected={option.id === selectedProfileId}
                        option={option}
                        idx={idx}
                        key={idx}
                        showDelete={profiles.length > 1}
                      />
                    ))}
                    <div
                      className="px-2 py-1"
                      style={{
                        color: lightGray,
                        fontSize: getFontSize() - 2,
                      }}
                    >
                      {profiles.length === 0 ? (
                        <i>No workspaces found</i>
                      ) : (
                        "Select workspace"
                      )}
                    </div>
                  </StyledListboxOptions>
                </Transition>,
                topDiv,
              )}
          </div>
        </StyledListbox>
      )}

      {controlServerBetaEnabled &&
        (session?.account ? (
          <ButtonWithTooltip
            tooltipPlacement="top-end"
            text={
              session.account.label === ""
                ? "Logged in"
                : `Logged in as ${session.account.label}`
            }
            onClick={logout}
          >
            <UserCircleIconSolid className="h-4 w-4" />
          </ButtonWithTooltip>
        ) : (
          <ButtonWithTooltip
            tooltipPlacement="top-end"
            text="Click to login to Continue"
            onClick={login}
          >
            <UserCircleIconOutline className="h-4 w-4" />
          </ButtonWithTooltip>
        ))}
    </>
  );
}

export default ProfileSwitcher;
