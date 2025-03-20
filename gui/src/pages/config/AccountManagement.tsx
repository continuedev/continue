import { Listbox, Transition } from "@headlessui/react";
import {
  ArrowTopRightOnSquareIcon,
  ChevronUpDownIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline";
import { Fragment, useContext, useEffect, useState } from "react";
import AssistantIcon from "../../components/modelSelection/platform/AssistantIcon";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch } from "../../redux/hooks";
import { selectProfileThunk } from "../../redux/thunks/profileAndOrg";
import { ScopeSelect } from "./ScopeSelect";

export function AccountManagement() {
  useNavigationListener();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const { session, login, profiles, selectedProfile, selectedOrganization } =
    useAuth();

  const changeProfileId = (id: string) => {
    dispatch(selectProfileThunk(id));
  };

  const [hubEnabled, setHubEnabled] = useState(false);

  useEffect(() => {
    ideMessenger.ide.getIdeSettings().then(({ continueTestEnvironment }) => {
      setHubEnabled(continueTestEnvironment === "production");
    });
  }, [ideMessenger]);

  function handleOpenConfig() {
    if (!selectedProfile) {
      return;
    }
    ideMessenger.post("config/openProfile", {
      profileId: selectedProfile.id,
    });
  }

  return (
    <div className="flex flex-col">
      <div className="flex max-w-[400px] flex-col gap-4 py-6">
        <h2 className="mb-1 mt-0">Configuration</h2>
        {hubEnabled ? (
          // Hub: show org selector
          session && (
            <div className="flex flex-col gap-1.5">
              <span className="text-lightgray text-sm">{`Organization`}</span>
              <ScopeSelect />
            </div>
          )
        ) : (
          // Continue for teams: show org text
          <div>You are using Continue for Teams</div>
        )}

        {profiles ? (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1.5 text-sm">
                <span className="text-lightgray">{`${hubEnabled ? "Assistant" : "Profile"}`}</span>
              </div>
              <Listbox value={selectedProfile?.id} onChange={changeProfileId}>
                {({ open }) => (
                  <div className="relative w-full">
                    <Listbox.Button className="border-vsc-input-border bg-vsc-background hover:bg-vsc-input-background text-vsc-foreground relative m-0 flex w-full cursor-pointer items-center justify-between rounded-md border border-solid px-3 py-2 text-left">
                      <div className="flex items-center gap-2">
                        {selectedProfile && (
                          <AssistantIcon assistant={selectedProfile} />
                        )}
                        <span className="lines lines-1">
                          {selectedProfile?.title ?? "No Assistant Selected"}
                        </span>
                      </div>
                      <div className="pointer-events-none flex items-center">
                        <ChevronUpDownIcon
                          className="h-5 w-5"
                          aria-hidden="true"
                        />
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
                      <Listbox.Options className="bg-vsc-background max-h-80vh absolute z-50 mt-0.5 w-full overflow-y-scroll rounded-sm p-0">
                        {profiles.map((option, idx) => (
                          <Listbox.Option
                            key={idx}
                            value={option.id}
                            className={`text-vsc-foreground hover:text-list-active-foreground flex cursor-pointer flex-row items-center gap-3 px-3 py-2 ${selectedProfile?.id === option.id ? "bg-list-active" : "bg-vsc-input-background"}`}
                          >
                            <AssistantIcon assistant={option} />
                            <span className="lines lines-1 relative flex h-5 items-center justify-between gap-3 pr-2 text-xs">
                              {option.title}
                            </span>
                          </Listbox.Option>
                        ))}
                        {hubEnabled && (
                          <Listbox.Option
                            key={"no-profiles"}
                            value={null}
                            className={`text-vsc-foreground hover:bg-list-active bg-vsc-input-background flex cursor-pointer flex-row items-center gap-2 px-3 py-2`}
                            onClick={() => {
                              if (session) {
                                ideMessenger.post("controlPlane/openUrl", {
                                  path: "new",
                                  orgSlug: selectedOrganization?.slug,
                                });
                              } else {
                                login(false);
                              }
                            }}
                          >
                            <PlusCircleIcon className="h-4 w-4" />
                            <span className="lines lines-1 flex items-center justify-between text-xs">
                              Create new Assistant
                            </span>
                          </Listbox.Option>
                        )}
                      </Listbox.Options>
                    </Transition>

                    {selectedProfile && (
                      <div className="mt-3 flex w-full justify-center">
                        <span
                          className="text-lightgray flex cursor-pointer items-center gap-1 hover:underline"
                          onClick={handleOpenConfig}
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                          {hubEnabled
                            ? "Open Assistant configuration"
                            : "View Workspace"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </Listbox>
            </div>
          </>
        ) : (
          <div>Loading...</div>
        )}
      </div>
    </div>
  );
}
