import { Listbox, Transition } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Fragment, useContext } from "react";
import styled from "styled-components";
import {
  Button,
  SecondaryButton,
  vscInputBackground,
  vscListActiveBackground,
  vscListActiveForeground,
} from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAuth } from "../context/Auth";
import { setSelectedProfileId } from "../redux/slices/sessionSlice";
import { useDispatch } from "react-redux";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";

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

export default function AccountDialog() {
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
      <div className="p-4 pt-0">
        <h1 className="mb-0.5 text-center text-2xl">Account</h1>
        <span className="text-lightgray mb-4 block text-center">
          Signed out
        </span>
        <Button className="w-full" onClick={login}>
          Sign in
        </Button>
      </div>
    );
  }

  if (!controlServerBetaEnabled) {
    return (
      <div className="p-4 pt-0">
        <h1 className="mb-1 text-2xl">Account</h1>
        <p>
          Continue For Teams is not enabled. You can enable it in your IDE
          settings.
        </p>
        <p>Using local config.</p>
      </div>
    );
  }

  const dispatch = useDispatch();

  const changeProfileId = (id: string) => {
    ideMessenger.post("didChangeSelectedProfile", { id });
    dispatch(setSelectedProfileId(id));
  };

  return (
    <div className="flex flex-col items-center gap-5 p-4 pt-0">
      <div className="flex flex-col items-center text-center">
        <h1 className="mb-1 text-2xl">Account</h1>
        <span className="text-lightgray text-sm">
          {session.account.label === "" ? (
            "Signed in"
          ) : (
            <>
              Signed in as{" "}
              <span className="italic">{session.account.label}</span>
            </>
          )}
        </span>
      </div>

      <div className="w-full">
        <span className="mb-1 block text-sm">Current workspace</span>

        <Listbox value={"local"} onChange={changeProfileId}>
          {({ open }) => (
            <div className="relative w-full">
              <Listbox.Button className="border-vsc-input-border bg-vsc-background hover:bg-vsc-input-background text-vsc-foreground relative m-0 flex w-full cursor-pointer items-center justify-between rounded-md border border-solid px-3 py-2 text-left">
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
                <Listbox.Options className="bg-vsc-background max-h-80vh absolute mt-0.5 w-full overflow-y-scroll rounded-sm p-0">
                  {profiles.map((option, idx) => (
                    <StyledListboxOption
                      key={idx}
                      selected={selectedProfile?.id === option.id}
                      value={option.id}
                      className="w-full"
                    >
                      <span className="lines lines-1 relative flex h-5 items-center justify-between gap-3 pr-2 text-xs">
                        {option.title}
                      </span>
                    </StyledListboxOption>
                  ))}
                  {profiles.length === 0 && (
                    <div className="px-4 py-2">
                      <i>No workspaces found</i>
                    </div>
                  )}
                </Listbox.Options>
              </Transition>
            </div>
          )}
        </Listbox>
      </div>

      <div className="flex w-full justify-end gap-2">
        <SecondaryButton className="w-auto" onClick={logout}>
          Sign out
        </SecondaryButton>
        <Button
          className="w-auto"
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
