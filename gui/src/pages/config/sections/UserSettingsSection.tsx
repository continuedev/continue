import { ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { HubSessionInfo } from "core/control-plane/AuthTypes";
import { isContinueTeamMember } from "core/util/isContinueTeamMember";
import { useContext, useEffect, useState } from "react";
import { Card, useFontSize } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import { setLocalStorage } from "../../../util/localStorage";
import { UserSetting } from "../components/UserSetting";
import { ConfigHeader } from "../ConfigHeader";
import { ContinueFeaturesMenu } from "../utils/ContinueFeaturesMenu";

export function UserSettingsSection() {
  /////// User settings section //////
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const currentOrg = useAppSelector(selectCurrentOrg);

  const [showExperimental, setShowExperimental] = useState(false);
  const { session } = useAuth();

  function handleUpdate(sharedConfig: SharedConfigSchema) {
    // Optimistic update
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    // IMPORTANT no need for model role updates (separate logic for selected model roles)
    // simply because this function won't be used to update model roles

    // Actual update to core which propagates back with config update event
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  // Disable autocomplete
  const disableAutocompleteInFiles = (
    config.tabAutocompleteOptions?.disableInFiles ?? []
  ).join(", ");
  const [formDisableAutocomplete, setFormDisableAutocomplete] = useState(
    disableAutocompleteInFiles,
  );

  useEffect(() => {
    // Necessary so that reformatted/trimmed values don't cause dirty state
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  }, [disableAutocompleteInFiles]);

  // Workspace prompts
  const promptPath = config.experimental?.promptPath || "";

  const handleEnableStaticContextualizationToggle = (value: boolean) => {
    handleUpdate({ enableStaticContextualization: value });
  };

  // TODO defaults are in multiple places, should be consolidated and probably not explicit here
  const showSessionTabs = config.ui?.showSessionTabs ?? false;
  const continueAfterToolRejection =
    config.ui?.continueAfterToolRejection ?? false;
  const codeWrap = config.ui?.codeWrap ?? false;
  const showChatScrollbar = config.ui?.showChatScrollbar ?? false;
  const readResponseTTS = config.experimental?.readResponseTTS ?? false;
  const autoAcceptEditToolDiffs = config.ui?.autoAcceptEditToolDiffs ?? false;
  const displayRawMarkdown = config.ui?.displayRawMarkdown ?? false;
  const disableSessionTitles = config.disableSessionTitles ?? false;
  const useCurrentFileAsContext =
    config.experimental?.useCurrentFileAsContext ?? false;
  const enableExperimentalTools =
    config.experimental?.enableExperimentalTools ?? false;
  const onlyUseSystemMessageTools =
    config.experimental?.onlyUseSystemMessageTools ?? false;
  const codebaseToolCallingOnly =
    config.experimental?.codebaseToolCallingOnly ?? false;
  const enableStaticContextualization =
    config.experimental?.enableStaticContextualization ?? false;

  const allowAnonymousTelemetry = config.allowAnonymousTelemetry ?? true;
  const disableIndexing = config.disableIndexing ?? false;

  // const useAutocompleteCache = config.tabAutocompleteOptions?.useCache ?? true;
  // const useChromiumForDocsCrawling =
  //   config.experimental?.useChromiumForDocsCrawling ?? false;
  // const codeBlockToolbarPosition = config.ui?.codeBlockToolbarPosition ?? "top";
  const useAutocompleteMultilineCompletions =
    config.tabAutocompleteOptions?.multilineCompletions ?? "auto";
  const modelTimeout = config.tabAutocompleteOptions?.modelTimeout ?? 150;
  const debounceDelay = config.tabAutocompleteOptions?.debounceDelay ?? 250;
  const fontSize = useFontSize();

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

  const [hubEnabled, setHubEnabled] = useState(false);
  useEffect(() => {
    void ideMessenger.ide
      .getIdeSettings()
      .then(({ continueTestEnvironment }) => {
        setHubEnabled(continueTestEnvironment === "production");
      });
  }, [ideMessenger]);

  const hasContinueEmail = isContinueTeamMember(
    (session as HubSessionInfo)?.account?.id,
  );

  const disableTelemetryToggle =
    currentOrg?.policy?.allowAnonymousTelemetry === false;
  const disableIndexingToggle =
    currentOrg?.policy?.allowCodebaseIndexing === false;

  return (
    <div>
      {hubEnabled ? (
        <div className="flex flex-col py-4">
          <ConfigHeader title="User Settings" />

          <div className="space-y-6">
            {/* Chat Interface Settings */}
            <div>
              <h3 className="mb-3 mt-0 text-base font-medium">Chat</h3>
              <Card>
                <div className="flex flex-col gap-4">
                  <UserSetting
                    type="toggle"
                    title="Show Session Tabs"
                    description="If on, displays tabs above the chat as an alternative way to organize and access your sessions."
                    value={showSessionTabs}
                    onChange={(value) =>
                      handleUpdate({ showSessionTabs: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title="Wrap Codeblocks"
                    description="If on, wraps long lines in code blocks instead of showing horizontal scroll."
                    value={codeWrap}
                    onChange={(value) => handleUpdate({ codeWrap: value })}
                  />
                  <UserSetting
                    type="toggle"
                    title="Show Chat Scrollbar"
                    description="If on, enables a scrollbar in the chat window."
                    value={showChatScrollbar}
                    onChange={(value) =>
                      handleUpdate({ showChatScrollbar: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title="Text-to-Speech Output"
                    description="If on, reads LLM responses aloud with TTS."
                    value={readResponseTTS}
                    onChange={(value) =>
                      handleUpdate({ readResponseTTS: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title="Enable Session Titles"
                    description="If on, generates summary titles for each chat session after the first message, using the current Chat model."
                    value={!disableSessionTitles}
                    onChange={(value) =>
                      handleUpdate({ disableSessionTitles: !value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title="Format Markdown"
                    description="If off, shows responses as raw text."
                    value={!displayRawMarkdown}
                    onChange={(value) =>
                      handleUpdate({ displayRawMarkdown: !value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title="Auto-Accept Agent Edits"
                    description="If on, diffs generated by the edit tool are automatically accepted and Agent proceeds with the next conversational turn."
                    value={autoAcceptEditToolDiffs}
                    onChange={(value) =>
                      handleUpdate({ autoAcceptEditToolDiffs: value })
                    }
                  />
                </div>
              </Card>
            </div>

            {/* Privacy Settings */}
            <div>
              <h3 className="mb-3 text-base font-medium">Privacy & Data</h3>
              <Card>
                <div className="flex flex-col gap-4">
                  <UserSetting
                    type="toggle"
                    title="Allow Anonymous Telemetry"
                    description="If on, allows Continue to send anonymous telemetry."
                    value={allowAnonymousTelemetry}
                    disabled={disableTelemetryToggle}
                    onChange={(value) =>
                      handleUpdate({ allowAnonymousTelemetry: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title="Enable Indexing"
                    description="If on, allows indexing of your codebase for better search and context understanding."
                    value={!disableIndexing}
                    disabled={disableIndexingToggle}
                    onChange={(value) =>
                      handleUpdate({ disableIndexing: !value })
                    }
                  />
                </div>
              </Card>
            </div>

            {/* Appearance Settings */}
            <div>
              <h3 className="mb-3 text-base font-medium">Appearance</h3>
              <Card>
                <div className="flex flex-col gap-4">
                  <UserSetting
                    type="number"
                    title="Font Size"
                    description="Specifies base font size for UI elements."
                    value={fontSize}
                    onChange={(val) => {
                      setLocalStorage("fontSize", val);
                      handleUpdate({ fontSize: val });
                    }}
                    min={7}
                    max={50}
                  />
                </div>
              </Card>
            </div>

            {/* Autocomplete Settings */}
            <div>
              <h3 className="mb-3 text-base font-medium">Autocomplete</h3>
              <Card>
                <div className="flex flex-col gap-4">
                  <UserSetting
                    type="select"
                    title="Multiline Autocompletions"
                    description="Controls multiline completions for autocomplete."
                    value={useAutocompleteMultilineCompletions}
                    onChange={(value) =>
                      handleUpdate({
                        useAutocompleteMultilineCompletions: value as
                          | "auto"
                          | "always"
                          | "never",
                      })
                    }
                    options={[
                      { label: "Auto", value: "auto" },
                      { label: "Always", value: "always" },
                      { label: "Never", value: "never" },
                    ]}
                  />
                  <UserSetting
                    type="number"
                    title="Autocomplete Timeout (ms)"
                    description="Maximum time in milliseconds for autocomplete request/retrieval."
                    value={modelTimeout}
                    onChange={(val) => handleUpdate({ modelTimeout: val })}
                    min={100}
                    max={5000}
                  />
                  <UserSetting
                    type="number"
                    title="Autocomplete Debounce (ms)"
                    description="Minimum time in milliseconds to trigger an autocomplete request after a change."
                    value={debounceDelay}
                    onChange={(val) => handleUpdate({ debounceDelay: val })}
                    min={0}
                    max={2500}
                  />
                  <UserSetting
                    type="input"
                    title="Disable autocomplete in files"
                    description="List of comma-separated glob pattern to disable autocomplete in matching files. E.g., **/*.(txt,md)"
                    value={formDisableAutocomplete}
                    onChange={setFormDisableAutocomplete}
                    onSubmit={handleDisableAutocompleteSubmit}
                    onCancel={cancelChangeDisableAutocomplete}
                    isDirty={
                      formDisableAutocomplete !== disableAutocompleteInFiles
                    }
                    isValid={formDisableAutocomplete.trim() !== ""}
                  />
                </div>
              </Card>
            </div>

            {/* Experimental Settings */}
            <div>
              <h3 className="mb-3 text-base font-medium">Experimental</h3>
              <Card>
                <div
                  className="flex cursor-pointer items-center gap-2 text-left text-sm font-semibold"
                  onClick={() => setShowExperimental(!showExperimental)}
                >
                  <ChevronRightIcon
                    className={`h-4 w-4 transition-transform ${
                      showExperimental ? "rotate-90" : ""
                    }`}
                  />
                  <span>Show Experimental Settings</span>
                </div>
                <div
                  className={`duration-400 overflow-hidden transition-all ease-in-out ${
                    showExperimental
                      ? "max-h-96" /* Increased from max-h-40 to max-h-96 to accommodate ContinueFeaturesMenu */
                      : "max-h-0"
                  }`}
                >
                  <div className="flex flex-col gap-x-1 gap-y-4 pl-6">
                    <UserSetting
                      type="toggle"
                      title="Add Current File by Default"
                      description="If on, the currently open file is added as context in every new conversation."
                      value={useCurrentFileAsContext}
                      onChange={(value) =>
                        handleUpdate({ useCurrentFileAsContext: value })
                      }
                    />
                    <UserSetting
                      type="toggle"
                      title="Enable experimental tools"
                      description="If on, enables access to experimental tools that are still in development."
                      value={enableExperimentalTools}
                      onChange={(value) =>
                        handleUpdate({ enableExperimentalTools: value })
                      }
                    />
                    <UserSetting
                      type="toggle"
                      title="Only use system message tools"
                      description="If on, Continue will not attempt to use native tool calling and will only use system message tools."
                      value={onlyUseSystemMessageTools}
                      onChange={(value) =>
                        handleUpdate({ onlyUseSystemMessageTools: value })
                      }
                    />
                    <UserSetting
                      type="toggle"
                      title="@Codebase: use tool calling only"
                      description="If on, @codebase context provider will only use tool calling for code retrieval."
                      value={codebaseToolCallingOnly}
                      onChange={(value) =>
                        handleUpdate({ codebaseToolCallingOnly: value })
                      }
                    />
                    <UserSetting
                      type="toggle"
                      title="Stream after tool rejection"
                      description="If on, streaming will continue after the tool call is rejected."
                      value={continueAfterToolRejection}
                      onChange={(value) =>
                        handleUpdate({ continueAfterToolRejection: value })
                      }
                    />

                    {hasContinueEmail && (
                      <ContinueFeaturesMenu
                        enableStaticContextualization={
                          enableStaticContextualization
                        }
                        handleEnableStaticContextualizationToggle={
                          handleEnableStaticContextualizationToggle
                        }
                      />
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
