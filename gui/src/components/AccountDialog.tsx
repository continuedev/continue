import { Listbox, Transition } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Fragment, useContext } from "react";
import styled from "styled-components";
import {
  Button,
  SecondaryButton,
  vscInputBackground,
  vscInputBorder,
  vscListActiveBackground,
  vscListActiveForeground,
} from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAuth } from "../context/Auth";
import { setSelectedProfileId } from "../redux/slices/stateSlice";
import { useDispatch } from "react-redux";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiStateSlice";
import { NewSessionButton } from "./mainInput/NewSessionButton";

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

  const dispatch = useDispatch();

  const changeProfileId = (id: string) => {
    ideMessenger.post("didChangeSelectedProfile", { id });
    dispatch(setSelectedProfileId(id));
  };

  return (
    <div className="p-4">
      <h1>Account</h1>

      <p className="">Select a workspace</p>

      <Listbox value={"local"} onChange={changeProfileId}>
        {({ open }) => (
          <div className="relative">
            <Listbox.Button
              className="bg-vsc-background hover:bg-vsc-input-background text-vsc-foreground xs:w-[170px] relative m-0 flex w-[130px] cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left sm:w-[220px]"
              style={{
                borderTop: `1px solid ${vscInputBorder}`,
                borderLeft: `1px solid ${vscInputBorder}`,
                borderRight: `1px solid ${vscInputBorder}`,
                borderBottom: `1px solid ${vscInputBorder}`,
              }}
            >
              <span className="lines lines-1">{selectedProfile?.title}</span>
              <div className="pointer-events-none flex items-center">
                <ChevronUpDownIcon className="h-5 w-5" aria-hidden="true" />
              </div>
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
              <Listbox.Options className="bg-vsc-background max-h-80vh xs:w-[170px] absolute w-[130px] overflow-y-scroll rounded-sm p-0 sm:w-[220px]">
                {profiles.map((option, idx) => (
                  <StyledListboxOption
                    key={idx}
                    selected={selectedProfile?.id === option.id}
                    value={option.id}
                    className="w-full"
                  >
                    <div className="lines lines-1 relative flex h-5 items-center justify-between gap-3 pr-2">
                      {option.title}
                    </div>
                  </StyledListboxOption>
                ))}
                {profiles.length === 0 ? (
                  <div className="px-4 py-2">
                    <i>No workspaces found</i>
                  </div>
                ) : null}
              </Listbox.Options>
            </Transition>
          </div>
        )}
      </Listbox>
      <p className="mt-6">
        {session.account.label === ""
          ? "Signed in"
          : `Signed in as ${session.account.label}`}
      </p>
      <div className="mt-3 flex flex-row justify-between gap-2">
        <SecondaryButton className="max-w-20 flex-1" onClick={logout}>
          Sign out
        </SecondaryButton>
        <Button
          className="max-w-20 flex-1"
          onClick={() => {
            dispatch(setDialogMessage(undefined));
            dispatch(setShowDialog(false));
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );
}

export default AccountDialog;
