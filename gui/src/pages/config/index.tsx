import { Fragment, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/PageHeader";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch } from "../../redux/hooks";
import { SecondaryButton } from "../../components";
import { useAuth } from "../../context/Auth";
import { ScopeSelect } from "./ScopeSelect";
import UserSettingsUI from "./UserSettings";
import { Listbox, Transition } from "@headlessui/react";
import { ChevronUpDownIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import { selectProfileThunk } from "../../redux/thunks/profileAndOrg";

function ConfigPage() {
  useNavigationListener();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const {
    session,
    logout,
    login,
    profiles,
    selectedProfile,
    controlServerBetaEnabled,
    selectedOrganization,
  } = useAuth();

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

  // NOTE Hub takes priority over Continue for Teams
  // Since teams will be moving to hub, not vice versa

  return (
    <div className="overflow-y-scroll">
      <PageHeader onTitleClick={() => navigate("/")} title="Chat" />

      <div className="divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4">
        <div className="flex flex-col">
          <div className="flex max-w-[400px] flex-col gap-4 py-4">
            <h2 className="mb-1 mt-0">Account</h2>
            {!session ? (
              <div className="flex flex-col gap-2">
                <span>You are not signed in.</span>
                <SecondaryButton onClick={() => login(false)}>
                  Sign in
                </SecondaryButton>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {hubEnabled ? (
                  // Hub: show org selector
                  <div className="flex flex-col gap-1.5">
                    <span className="text-lightgray">{`Organization`}</span>
                    <ScopeSelect />
                  </div>
                ) : (
                  // Continue for teams: show org text
                  <div>You are using Continue for Teams</div>
                )}
                <div className="flex flex-row items-center gap-2">
                  <span className="text-lightgray">
                    {session.account.label === ""
                      ? "Signed in"
                      : `Signed in as ${session.account.label}`}
                  </span>
                  <span
                    onClick={logout}
                    className="text-lightgray cursor-pointer underline"
                  >{`Sign out`}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex max-w-[400px] flex-col gap-4 py-6">
            <h2 className="mb-1 mt-0">Configuration</h2>
            <Listbox value={selectedProfile?.id} onChange={changeProfileId}>
              {({ open }) => (
                <div className="relative w-full">
                  <Listbox.Button className="border-vsc-input-border bg-vsc-background hover:bg-vsc-input-background text-vsc-foreground relative m-0 flex w-full cursor-pointer items-center justify-between rounded-md border border-solid px-3 py-2 text-left">
                    <span className="lines lines-1">
                      {selectedProfile?.title ?? "No Assistant Selected"}
                    </span>
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
                    <Listbox.Options className="bg-vsc-background max-h-80vh absolute mt-0.5 w-full overflow-y-scroll rounded-sm p-0">
                      {profiles.map((option, idx) => (
                        <Listbox.Option
                          key={idx}
                          value={option.id}
                          className={`text-vsc-foreground hover:text-list-active-foreground flex cursor-pointer flex-row items-center gap-3 px-3 py-2 ${selectedProfile?.id === option.id ? "bg-list-active" : "bg-vsc-input-background"}`}
                        >
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
                            ideMessenger.post("controlPlane/openUrl", {
                              path: "new",
                              orgSlug: selectedOrganization?.slug,
                            });
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
                </div>
              )}
            </Listbox>
            {selectedProfile && (
              <SecondaryButton onClick={handleOpenConfig}>
                {selectedProfile.id === "local"
                  ? "Open Config File"
                  : hubEnabled
                    ? "Open Assistant"
                    : "Open Workspace"}
              </SecondaryButton>
            )}
          </div>
        </div>
        {!controlServerBetaEnabled || hubEnabled ? (
          <div className="flex flex-col">
            <div className="flex max-w-[400px] flex-col">
              <UserSettingsUI />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ConfigPage;
