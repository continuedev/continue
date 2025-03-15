import { ModelRole } from "@continuedev/config-yaml";
import { Listbox, Transition } from "@headlessui/react";
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ChevronUpDownIcon,
  PlusCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ModelDescription } from "core";
import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { Fragment, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "../../components";
import NumberInput from "../../components/gui/NumberInput";
import { Select } from "../../components/gui/Select";
import ToggleSwitch from "../../components/gui/Switch";
import AssistantIcon from "../../components/modelSelection/platform/AssistantIcon";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setDefaultModel, updateConfig } from "../../redux/slices/configSlice";
import { selectProfileThunk } from "../../redux/thunks/profileAndOrg";
import { getFontSize, isJetBrains } from "../../util";
import ModelRoleSelector from "./ModelRoleSelector";
import { ScopeSelect } from "./ScopeSelect";

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

  /////// User settings section //////
  const config = useAppSelector((state) => state.config.config);
  const selectedChatModel = useAppSelector(
    (store) => store.config.defaultModelTitle,
  );

  function handleUpdate(sharedConfig: SharedConfigSchema) {
    // Optimistic update
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    // IMPORTANT no need for model role updates (separate logic for selected model roles)
    // simply because this function won't be used to update model roles

    // Actual update to core which propagates back with config update event
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  function handleRoleUpdate(role: ModelRole, model: ModelDescription | null) {
    if (!selectedProfile) {
      return;
    }
    // Optimistic update
    dispatch(
      updateConfig({
        ...config,
        selectedModelByRole: {
          ...config.selectedModelByRole,
          [role]: model,
        },
      }),
    );
    ideMessenger.post("config/updateSelectedModel", {
      profileId: selectedProfile.id,
      role,
      title: model?.title ?? null,
    });
  }

  // TODO use handleRoleUpdate for chat
  function handleChatModelSelection(model: ModelDescription | null) {
    if (!model) {
      return;
    }
    dispatch(setDefaultModel({ title: model.title }));
  }

  // TODO defaults are in multiple places, should be consolidated and probably not explicit here
  const showSessionTabs = config.ui?.showSessionTabs ?? false;
  const codeWrap = config.ui?.codeWrap ?? false;
  const showChatScrollbar = config.ui?.showChatScrollbar ?? false;
  const displayRawMarkdown = config.ui?.displayRawMarkdown ?? false;
  const disableSessionTitles = config.disableSessionTitles ?? false;
  const readResponseTTS = config.experimental?.readResponseTTS ?? false;

  const allowAnonymousTelemetry = config.allowAnonymousTelemetry ?? true;
  const disableIndexing = config.disableIndexing ?? false;

  const useAutocompleteCache = config.tabAutocompleteOptions?.useCache ?? false;
  const useChromiumForDocsCrawling =
    config.experimental?.useChromiumForDocsCrawling ?? false;
  const codeBlockToolbarPosition = config.ui?.codeBlockToolbarPosition ?? "top";
  const useAutocompleteMultilineCompletions =
    config.tabAutocompleteOptions?.multilineCompletions ?? "auto";
  const fontSize = getFontSize();

  // Disable autocomplete
  const disableAutocompleteInFiles = (
    config.tabAutocompleteOptions?.disableInFiles ?? []
  ).join(", ");
  const [formDisableAutocomplete, setFormDisableAutocomplete] = useState(
    disableAutocompleteInFiles,
  );
  const cancelChangeDisableAutocomplete = () => {
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  };
  const handleDisableAutocompleteSubmit = () => {
    handleUpdate({
      disableAutocompleteInFiles: formDisableAutocomplete
        .split(",")
        .map((val) => val.trim())
        .filter((val) => !!val),
    });
  };

  useEffect(() => {
    // Necessary so that reformatted/trimmed values don't cause dirty state
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  }, [disableAutocompleteInFiles]);

  // Workspace prompts
  const promptPath = config.experimental?.promptPath || "";
  const [formPromptPath, setFormPromptPath] = useState(promptPath);
  const cancelChangePromptPath = () => {
    setFormPromptPath(promptPath);
  };
  const handleSubmitPromptPath = () => {
    handleUpdate({
      promptPath: formPromptPath || "",
    });
  };

  useEffect(() => {
    // Necessary so that reformatted/trimmed values don't cause dirty state
    setFormPromptPath(promptPath);
  }, [promptPath]);

  const jetbrains = isJetBrains();

  return (
    <div className="overflow-y-scroll">
      <PageHeader showBorder onTitleClick={() => navigate("/")} title="Chat" />

      <div className="divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4">
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
                  <Listbox
                    value={selectedProfile?.id}
                    onChange={changeProfileId}
                  >
                    {({ open }) => (
                      <div className="relative w-full">
                        <Listbox.Button className="border-vsc-input-border bg-vsc-background hover:bg-vsc-input-background text-vsc-foreground relative m-0 flex w-full cursor-pointer items-center justify-between rounded-md border border-solid px-3 py-2 text-left">
                          <div className="flex items-center gap-2">
                            {selectedProfile && (
                              <AssistantIcon assistant={selectedProfile} />
                            )}
                            <span className="lines lines-1">
                              {selectedProfile?.title ??
                                "No Assistant Selected"}
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

        {/* Model Roles as a separate section */}
        <div className="flex flex-col">
          <div className="flex max-w-[400px] flex-col gap-4 py-6">
            <h2 className="mb-1 mt-0">Model Roles</h2>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr]">
              <ModelRoleSelector
                displayName="Chat"
                description="Used in the chat interface"
                models={config.modelsByRole.chat}
                selectedModel={{
                  title: selectedChatModel,
                  provider: "mock",
                  model: "mock",
                }}
                onSelect={(model) => handleChatModelSelection(model)}
              />
              <ModelRoleSelector
                displayName="Autocomplete"
                description="Used to generate code completion suggestions"
                models={config.modelsByRole.autocomplete}
                selectedModel={config.selectedModelByRole.autocomplete}
                onSelect={(model) => handleRoleUpdate("autocomplete", model)}
              />
              {/* Jetbrains has a model selector inline */}
              {!jetbrains && (
                <ModelRoleSelector
                  displayName="Edit"
                  description="Used for inline edits"
                  models={config.modelsByRole.edit}
                  selectedModel={config.selectedModelByRole.edit}
                  onSelect={(model) => handleRoleUpdate("edit", model)}
                />
              )}
              <ModelRoleSelector
                displayName="Apply"
                description="Used to apply generated codeblocks to files"
                models={config.modelsByRole.apply}
                selectedModel={config.selectedModelByRole.apply}
                onSelect={(model) => handleRoleUpdate("apply", model)}
              />
              <ModelRoleSelector
                displayName="Embed"
                description="Used to generate and query embeddings for the @codebase and @docs context providers"
                models={config.modelsByRole.embed}
                selectedModel={config.selectedModelByRole.embed}
                onSelect={(model) => handleRoleUpdate("embed", model)}
              />
              <ModelRoleSelector
                displayName="Rerank"
                description="Used for reranking results from the @codebase and @docs context providers"
                models={config.modelsByRole.rerank}
                selectedModel={config.selectedModelByRole.rerank}
                onSelect={(model) => handleRoleUpdate("rerank", model)}
              />
            </div>
          </div>
        </div>

        {!controlServerBetaEnabled || hubEnabled ? (
          <div className="flex flex-col">
            <div className="flex max-w-[400px] flex-col">
              <div className="flex flex-col gap-4 py-6">
                <div>
                  <h2 className="mb-2 mt-0">User settings</h2>
                </div>

                <div className="flex flex-col gap-4">
                  <ToggleSwitch
                    isToggled={showSessionTabs}
                    onToggle={() =>
                      handleUpdate({
                        showSessionTabs: !showSessionTabs,
                      })
                    }
                    text="Show Session Tabs"
                  />
                  <ToggleSwitch
                    isToggled={codeWrap}
                    onToggle={() =>
                      handleUpdate({
                        codeWrap: !codeWrap,
                      })
                    }
                    text="Wrap Codeblocks"
                  />
                  <ToggleSwitch
                    isToggled={displayRawMarkdown}
                    onToggle={() =>
                      handleUpdate({
                        displayRawMarkdown: !displayRawMarkdown,
                      })
                    }
                    text="Display Raw Markdown"
                  />
                  <ToggleSwitch
                    isToggled={allowAnonymousTelemetry}
                    onToggle={() =>
                      handleUpdate({
                        allowAnonymousTelemetry: !allowAnonymousTelemetry,
                      })
                    }
                    text="Allow Anonymous Telemetry"
                  />
                  <ToggleSwitch
                    isToggled={disableIndexing}
                    onToggle={() =>
                      handleUpdate({
                        disableIndexing: !disableIndexing,
                      })
                    }
                    text="Disable Indexing"
                  />

                  <ToggleSwitch
                    isToggled={disableSessionTitles}
                    onToggle={() =>
                      handleUpdate({
                        disableSessionTitles: !disableSessionTitles,
                      })
                    }
                    text="Disable Session Titles"
                  />
                  <ToggleSwitch
                    isToggled={readResponseTTS}
                    onToggle={() =>
                      handleUpdate({
                        readResponseTTS: !readResponseTTS,
                      })
                    }
                    text="Response Text to Speech"
                  />

                  <ToggleSwitch
                    isToggled={showChatScrollbar}
                    onToggle={() =>
                      handleUpdate({
                        showChatScrollbar: !showChatScrollbar,
                      })
                    }
                    text="Show Chat Scrollbar"
                  />

                  <ToggleSwitch
                    isToggled={useAutocompleteCache}
                    onToggle={() =>
                      handleUpdate({
                        useAutocompleteCache: !useAutocompleteCache,
                      })
                    }
                    text="Use Autocomplete Cache"
                  />

                  <ToggleSwitch
                    isToggled={useChromiumForDocsCrawling}
                    onToggle={() =>
                      handleUpdate({
                        useChromiumForDocsCrawling: !useChromiumForDocsCrawling,
                      })
                    }
                    text="Use Chromium for Docs Crawling"
                  />

                  <label className="flex items-center justify-between gap-3">
                    <span className="lines lines-1 text-left">
                      Multiline Autocompletions
                    </span>
                    <Select
                      value={useAutocompleteMultilineCompletions}
                      onChange={(e) =>
                        handleUpdate({
                          useAutocompleteMultilineCompletions: e.target
                            .value as "auto" | "always" | "never",
                        })
                      }
                    >
                      <option value="auto">Auto</option>
                      <option value="always">Always</option>
                      <option value="never">Never</option>
                    </Select>
                  </label>

                  <label className="flex items-center justify-between gap-3">
                    <span className="text-left">Font Size</span>
                    <NumberInput
                      value={fontSize}
                      onChange={(val) =>
                        handleUpdate({
                          fontSize: val,
                        })
                      }
                      min={7}
                      max={50}
                    />
                  </label>

                  <form
                    className="flex flex-col gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleDisableAutocompleteSubmit();
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Disable autocomplete in files</span>
                      <div className="flex items-center gap-2">
                        <Input
                          value={formDisableAutocomplete}
                          className="max-w-[100px]"
                          onChange={(e) => {
                            setFormDisableAutocomplete(e.target.value);
                          }}
                        />
                        <div className="flex h-full flex-col">
                          {formDisableAutocomplete !==
                          disableAutocompleteInFiles ? (
                            <>
                              <div
                                onClick={handleDisableAutocompleteSubmit}
                                className="cursor-pointer"
                              >
                                <CheckIcon className="h-4 w-4 text-green-500 hover:opacity-80" />
                              </div>
                              <div
                                onClick={cancelChangeDisableAutocomplete}
                                className="cursor-pointer"
                              >
                                <XMarkIcon className="h-4 w-4 text-red-500 hover:opacity-80" />
                              </div>
                            </>
                          ) : (
                            <div>
                              <CheckIcon className="text-vsc-foreground-muted h-4 w-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-vsc-foreground-muted text-lightgray self-end text-xs">
                      Comma-separated list of path matchers
                    </span>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ConfigPage;
