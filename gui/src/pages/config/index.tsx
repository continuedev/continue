import { ModelRole } from "@continuedev/config-yaml";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ModelDescription } from "core";
import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "../../components";
import NumberInput from "../../components/gui/NumberInput";
import { Select } from "../../components/gui/Select";
import ToggleSwitch from "../../components/gui/Switch";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectDefaultModel,
  setDefaultModel,
  updateConfig,
} from "../../redux/slices/configSlice";
import { getFontSize, isJetBrains } from "../../util";
import { AccountButton } from "./AccountButton";
import { AccountManagement } from "./AccountManagement";
import ModelRoleSelector from "./ModelRoleSelector";

function ConfigPage() {
  useNavigationListener();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const { selectedProfile, controlServerBetaEnabled } = useAuth();

  const [hubEnabled, setHubEnabled] = useState(false);
  useEffect(() => {
    ideMessenger.ide.getIdeSettings().then(({ continueTestEnvironment }) => {
      setHubEnabled(continueTestEnvironment === "production");
    });
  }, [ideMessenger]);

  // NOTE Hub takes priority over Continue for Teams
  // Since teams will be moving to hub, not vice versa

  /////// User settings section //////
  const config = useAppSelector((state) => state.config.config);
  const selectedChatModel = useAppSelector(selectDefaultModel);

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

  const jetbrains = isJetBrains();

  return (
    <div className="overflow-y-scroll">
      <PageHeader
        showBorder
        onTitleClick={() => navigate("/")}
        title="Chat"
        rightContent={<AccountButton />}
      />

      <div className="divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4">
        <AccountManagement hubEnabled={hubEnabled} />

        {/* Model Roles as a separate section */}
        <div className="flex flex-col">
          <div className="flex max-w-[400px] flex-col gap-4 py-6">
            <h2 className="mb-1 mt-0">Model Roles</h2>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr]">
              <ModelRoleSelector
                displayName="Chat"
                description="Used in the chat interface"
                models={config.modelsByRole.chat}
                selectedModel={
                  selectedChatModel
                    ? {
                        title: selectedChatModel.title,
                        provider: selectedChatModel.provider,
                        model: selectedChatModel.model,
                      }
                    : null
                }
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
