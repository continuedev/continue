import { Listbox, Transition } from "@headlessui/react";
import {
  ChevronUpDownIcon,
  UserCircleIcon as UserCircleIconOutline,
} from "@heroicons/react/24/outline";
import { UserCircleIcon as UserCircleIconSolid } from "@heroicons/react/24/solid";
import { ProfileDescription } from "core/config/ConfigHandler";
import { Fragment, useContext, useRef, useState } from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";
import {
  Button,
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscForeground,
  vscInputBackground,
  vscListActiveBackground,
  vscListActiveForeground,
} from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { getFontSize } from "../util";
import HeaderButtonWithToolTip from "./gui/HeaderButtonWithToolTip";
import { useAuth } from "../context/Auth";

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
  return (
    <StyledListboxOption key={idx} selected={selected} value={option.id}>
      <div className="relative flex h-5 items-center justify-between gap-3">
        {option.title}
      </div>
    </StyledListboxOption>
  );
}

function AccountDialog() {
  const ideMessenger = useContext(IdeMessengerContext);
  const {
    session,
    logout,
    login,
    profiles,
    selectedProfile,
    controlServerBetaEnabled,
  } = useAuth();

  // These shouldn't usually show but just to be safe
  if (!session?.account?.id) {
    return (
      <div className="p-4">
        <h1>Account</h1>
        <p>Not signed in</p>
        <Button onClick={login}>Login</Button>
      </div>
    );
  }

  if (!controlServerBetaEnabled) {
    return (
      <div className="p-4">
        <h1>Account</h1>
        <p>
          Continue for teams is not enabled. You can enable it in your IDE
          settings
        </p>
        <p>Using local config.</p>
        <Button>Close</Button>
      </div>
    );
  }

  const topDiv = useRef<HTMLDivElement>(null);

  return (
    <div className="p-4">
      <h1>Account</h1>
      {!!topDiv.current &&
        ReactDOM.createPortal(
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            show={true}
          >
            <StyledListboxOptions>
              {profiles.map((option, idx) => (
                <ListBoxOption
                  selected={option.id === selectedProfile.id}
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
          topDiv.current,
        )}
      <StyledListbox
        ref={topDiv}
        value={"GPT-4"}
        onChange={(id: string) => {
          ideMessenger.post("didChangeSelectedProfile", { id });
        }}
      >
        <div className="relative">
          <StyledListboxButton>
            <span className="truncate">{selectedProfile?.title}</span>
            <div className="pointer-events-none flex items-center">
              <ChevronUpDownIcon
                className="h-4 w-4 text-gray-400"
                aria-hidden="true"
              />
            </div>
          </StyledListboxButton>
        </div>
      </StyledListbox>
      <div className="mt-4 flex flex-col items-start gap-2">
        {session.account.label === ""
          ? "Signed in"
          : `Signed in as ${session.account.label}`}
        <Button onClick={logout}>Sign out</Button>
      </div>
    </div>
  );
}

export default AccountDialog;
