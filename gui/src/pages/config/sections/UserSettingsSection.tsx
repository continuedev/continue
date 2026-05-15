import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { HubSessionInfo } from "core/control-plane/AuthTypes";
import { isContinueTeamMember } from "core/util/isContinueTeamMember";
import { useContext, useEffect, useState } from "react";
import { Toggle, useFontSize } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import { setLocalStorage } from "../../../util/localStorage";
import { ConfigHeader } from "../components/ConfigHeader";
import { ContinueFeaturesMenu } from "../components/ContinueFeaturesMenu";
import { SettingsPanel } from "../components/SettingsPanel";
import { UserSetting } from "../components/UserSetting";

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

  const hasContinueEmail = isContinueTeamMember(
    (session as HubSessionInfo)?.account?.id,
  );

  const disableTelemetryToggle =
    currentOrg?.policy?.allowAnonymousTelemetry === false;

  return (
    <div className="flex flex-col">
      <ConfigHeader
        title="General"
        subtext="Configure conversation behavior, privacy, autocomplete, and experimental workspace preferences."
      />

      <div className="space-y-8">
        <SettingsPanel
          anchorId="conversation"
          title="Conversation"
          description="Session chrome, message rendering, scrolling, and spoken output."
        >
          <UserSetting
            type="toggle"
            title="Show Session Tabs"
            description="Displays tabs above the chat as an alternative way to organize and access your sessions."
            value={showSessionTabs}
            onChange={(value) => handleUpdate({ showSessionTabs: value })}
          />
          <UserSetting
            type="toggle"
            title="Wrap Codeblocks"
            description="Wraps long lines in code blocks instead of showing horizontal scroll."
            value={codeWrap}
            onChange={(value) => handleUpdate({ codeWrap: value })}
          />
          <UserSetting
            type="toggle"
            title="Show Chat Scrollbar"
            description="Enables a scrollbar in the chat window."
            value={showChatScrollbar}
            onChange={(value) => handleUpdate({ showChatScrollbar: value })}
          />
          <UserSetting
            type="toggle"
            title="Text-to-Speech Output"
            description="Reads LLM responses aloud with TTS."
            value={readResponseTTS}
            onChange={(value) => handleUpdate({ readResponseTTS: value })}
          />
          <UserSetting
            type="toggle"
            title="Enable Session Titles"
            description="Generates summary titles for each chat session after the first message, using the current Chat model."
            value={!disableSessionTitles}
            onChange={(value) => handleUpdate({ disableSessionTitles: !value })}
          />
          <UserSetting
            type="toggle"
            title="Format Markdown"
            description="If off, shows responses as raw text."
            value={!displayRawMarkdown}
            onChange={(value) => handleUpdate({ displayRawMarkdown: !value })}
          />
        </SettingsPanel>

        <SettingsPanel
          anchorId="appearance"
          title="Appearance"
          description="Adjust interface density and typography for the chat surface."
        >
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
        </SettingsPanel>

        <SettingsPanel
          anchorId="privacy-telemetry"
          title="Privacy & Telemetry"
          description="Control anonymous telemetry behavior for this workspace and account."
        >
          <UserSetting
            type="toggle"
            title="Allow Anonymous Telemetry"
            description="Allows Yuto Agentic to send anonymous telemetry."
            value={allowAnonymousTelemetry}
            disabled={disableTelemetryToggle}
            onChange={(value) =>
              handleUpdate({ allowAnonymousTelemetry: value })
            }
          />
        </SettingsPanel>

        <SettingsPanel
          anchorId="autocomplete"
          title="Autocomplete"
          description="Tune completion length, latency, and file-level exclusions."
        >
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
            description="Maximum time in milliseconds for autocomplete request or retrieval."
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
            description="List of comma-separated glob patterns to disable autocomplete in matching files."
            placeholder="**/*.(txt,md)"
            value={formDisableAutocomplete}
            onChange={setFormDisableAutocomplete}
            onSubmit={handleDisableAutocompleteSubmit}
            onCancel={cancelChangeDisableAutocomplete}
            isDirty={formDisableAutocomplete !== disableAutocompleteInFiles}
            isValid={formDisableAutocomplete.trim() !== ""}
          />
        </SettingsPanel>

        <SettingsPanel
          anchorId="experimental"
          title="Experimental"
          description="Higher-risk features that may still change or require additional validation."
        >
          <div className="px-4 py-4">
            <Toggle
              isOpen={showExperimental}
              onToggle={() => setShowExperimental(!showExperimental)}
              title="Show Experimental Settings"
              subtitle="Reveal advanced options for context, tools, and streaming behavior"
            >
              <div className="border-command-border overflow-hidden rounded-lg border border-solid">
                <UserSetting
                  type="toggle"
                  title="Add Current File by Default"
                  description="The currently open file is added as context in every new conversation."
                  value={useCurrentFileAsContext}
                  onChange={(value) =>
                    handleUpdate({ useCurrentFileAsContext: value })
                  }
                />
                <UserSetting
                  type="toggle"
                  title="Enable experimental tools"
                  description="Enables access to experimental tools that are still in development."
                  value={enableExperimentalTools}
                  onChange={(value) =>
                    handleUpdate({ enableExperimentalTools: value })
                  }
                />
                <UserSetting
                  type="toggle"
                  title="Only use system message tools"
                  description="Yuto Agentic will not attempt to use native tool calling and will only use system message tools."
                  value={onlyUseSystemMessageTools}
                  onChange={(value) =>
                    handleUpdate({ onlyUseSystemMessageTools: value })
                  }
                />
                <UserSetting
                  type="toggle"
                  title="@Codebase: use tool calling only"
                  description="The @codebase context provider will only use tool calling for code retrieval."
                  value={codebaseToolCallingOnly}
                  onChange={(value) =>
                    handleUpdate({ codebaseToolCallingOnly: value })
                  }
                />
                <UserSetting
                  type="toggle"
                  title="Stream after tool rejection"
                  description="Streaming will continue after the tool call is rejected."
                  value={continueAfterToolRejection}
                  onChange={(value) =>
                    handleUpdate({ continueAfterToolRejection: value })
                  }
                />
                {hasContinueEmail && (
                  <div className="px-4 py-4">
                    <ContinueFeaturesMenu
                      enableStaticContextualization={
                        enableStaticContextualization
                      }
                      handleEnableStaticContextualizationToggle={
                        handleEnableStaticContextualizationToggle
                      }
                    />
                  </div>
                )}
              </div>
            </Toggle>
          </div>
        </SettingsPanel>
      </div>
    </div>
  );
}
