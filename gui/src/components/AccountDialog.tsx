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

const ProfileDropdownPortalDiv = styled.div`
  background-color: ${vscInputBackground};
  position: relative;
  margin-left: 8px;
  z-index: 1200;
  font-size: ${getFontSize() - 2};
`;

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

      <h2>Select a workspace</h2>

      {/* <div className="w-72">
        <Listbox value={selectedProfile.id} onChange={setSelectedProfileId}>
          {({ open }) => (
            <>
              <div className="relative">
                <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm">
                  <span className="block truncate">
                    {selectedProfile.title}
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <SelectorIcon
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </span>
                </Listbox.Button>

                <Transition
                  as={Fragment}
                  show={open}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {people.map((person) => (
                      <Listbox.Option
                        key={person.id}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active
                              ? "bg-amber-100 text-amber-900"
                              : "text-gray-900"
                          }`
                        }
                        value={person}
                      >
                        {({ selected, active }) => (
                          <>
                            <span
                              className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
                            >
                              {person.name}
                            </span>
                            {selected ? (
                              <span
                                className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                  active ? "text-amber-600" : "text-amber-600"
                                }`}
                              >
                                <CheckIcon
                                  className="h-5 w-5"
                                  aria-hidden="true"
                                />
                              </span>
                            ) : null}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </>
          )}
        </Listbox>
      </div> */}

      {!!topDiv.current &&
        ReactDOM.createPortal(
          <Transition
            as={Fragment}
            leave="transitfion ease-in duration-100"
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
      <ProfileDropdownPortalDiv ref={topDiv} />
      <StyledListbox
        value={"local"}
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

import { CheckIcon, SelectorIcon } from "@heroicons/react/solid";
import { setSelectedProfileId } from "../redux/slices/stateSlice";

const people = [
  { id: 1, name: "Wade Cooper" },
  { id: 2, name: "Arlene Mccoy" },
  { id: 3, name: "Devon Webb" },
  { id: 4, name: "Tom Cook" },
  { id: 5, name: "Tanya Fox" },
  { id: 6, name: "Hellen Schmidt" },
];

function MyListBox() {
  const [selectedPerson, setSelectedPerson] = useState(people[0]);

  return (
    <div className="w-72">
      <Listbox value={selectedPerson} onChange={setSelectedPerson}>
        {({ open }) => (
          <>
            <div className="relative">
              <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm">
                <span className="block truncate">{selectedPerson.name}</span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <SelectorIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>

              <Transition
                as={Fragment}
                show={open}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {people.map((person) => (
                    <Listbox.Option
                      key={person.id}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                          active
                            ? "bg-amber-100 text-amber-900"
                            : "text-gray-900"
                        }`
                      }
                      value={person}
                    >
                      {({ selected, active }) => (
                        <>
                          <span
                            className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
                          >
                            {person.name}
                          </span>
                          {selected ? (
                            <span
                              className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                active ? "text-amber-600" : "text-amber-600"
                              }`}
                            >
                              <CheckIcon
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </>
        )}
      </Listbox>
    </div>
  );
}
