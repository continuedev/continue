import { Listbox, Transition } from "@headlessui/react";
import {
  ChevronUpDownIcon,
  Cog6ToothIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { ProfileDescription } from "core/config/handler";
import { Fragment, useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscBackground,
  vscForeground,
  vscInputBackground,
  vscListActiveBackground,
  vscListActiveForeground,
} from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAuth } from "../hooks/useAuth";
import { isJetBrains } from "../util";
import HeaderButtonWithText from "./HeaderButtonWithText";

const StyledListbox = styled(Listbox)`
  background-color: ${vscBackground};
  padding: 0;
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

  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;

  color: ${vscForeground};

  padding: 4px 8px;

  &:focus {
    outline: none;
  }

  &:hover {
    background-color: ${vscInputBackground};
  }
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
  const ideMessenger = useContext(IdeMessengerContext);

  const dispatch = useDispatch();
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
      <div className="flex items-center justify-between gap-3 h-5 relative">
        {option.title}
      </div>
    </StyledListboxOption>
  );
}

function ProfileSwitcher(props: {}) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { session, logout, login } = useAuth();

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [profiles, setProfiles] = useState<ProfileDescription[]>([]);

  const [controlServerBetaEnabled, setControlServerBetaEnabled] =
    useState(false);

  useEffect(() => {
    ideMessenger.ide.getIdeSettings().then((settings) => {
      setControlServerBetaEnabled(settings.enableControlServerBeta);
    });
  }, []);

  useEffect(() => {
    ideMessenger.request("config/listProfiles", undefined).then(setProfiles);
  }, []);

  const topDiv = document.getElementById("model-select-top-div");

  return (
    <>
      {controlServerBetaEnabled && profiles.length > 0 && (
        <StyledListbox value={"GPT-4"} onChange={(val: string) => {}}>
          <div className="relative">
            <StyledListboxButton>
              <div>{profiles[selectedIndex]?.title}</div>
              <div className="pointer-events-none flex items-center">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
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
                        selected={idx === selectedIndex}
                        option={option}
                        idx={idx}
                        key={idx}
                        showDelete={profiles.length > 1}
                      />
                    ))}
                    {profiles.length === 0 && <i>No profiles found</i>}
                  </StyledListboxOptions>
                </Transition>,
                topDiv,
              )}
          </div>
        </StyledListbox>
      )}

      {/* Settings button only applies to local profile */}
      {profiles[selectedIndex]?.id !== "local" || (
        <HeaderButtonWithText
          onClick={() => {
            // navigate("/settings");
            ideMessenger.post("openConfigJson", undefined);
          }}
          text="Configure Continue"
        >
          <Cog6ToothIcon width="1.4em" height="1.4em" />
        </HeaderButtonWithText>
      )}

      {/* Only show login if beta explicitly enabled */}
      {!isJetBrains() && controlServerBetaEnabled && (
        <HeaderButtonWithText
          text={
            session?.account
              ? `Logged in as ${session.account.label}`
              : "Click to login to Continue"
          }
          onClick={() => {
            if (session.account) {
              logout();
            } else {
              login();
            }
          }}
        >
          <UserCircleIcon width="1.4em" height="1.4em" />
        </HeaderButtonWithText>
      )}
    </>
  );
}

export default ProfileSwitcher;
