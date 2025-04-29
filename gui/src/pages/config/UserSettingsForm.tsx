import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { useContext, useEffect, useState } from "react";
import { Input } from "../../components";
import NumberInput from "../../components/gui/NumberInput";
import { Select } from "../../components/gui/Select";
import ToggleSwitch from "../../components/gui/Switch";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { updateConfig } from "../../redux/slices/configSlice";
import { getFontSize } from "../../util";

export function UserSettingsForm() {
  /////// User settings section //////
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);

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

  // TODO defaults are in multiple places, should be consolidated and probably not explicit here
  const showSessionTabs = config.ui?.showSessionTabs ?? false;
  const codeWrap = config.ui?.codeWrap ?? false;
  const showChatScrollbar = config.ui?.showChatScrollbar ?? false;
  const readResponseTTS = config.experimental?.readResponseTTS ?? false;
  const displayRawMarkdown = config.ui?.displayRawMarkdown ?? false;
  const disableSessionTitles = config.disableSessionTitles ?? false;

  const allowAnonymousTelemetry = config.allowAnonymousTelemetry ?? true;
  const disableIndexing = config.disableIndexing ?? false;

  // const useAutocompleteCache = config.tabAutocompleteOptions?.useCache ?? true;
  // const useChromiumForDocsCrawling =
  //   config.experimental?.useChromiumForDocsCrawling ?? false;
  // const codeBlockToolbarPosition = config.ui?.codeBlockToolbarPosition ?? "top";
  const useAutocompleteMultilineCompletions =
    config.tabAutocompleteOptions?.multilineCompletions ?? "auto";
  const fontSize = getFontSize();

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
    ideMessenger.ide.getIdeSettings().then(({ continueTestEnvironment }) => {
      setHubEnabled(continueTestEnvironment === "production");
    });
  }, [ideMessenger]);

  return (
    <div className="flex flex-col pt-3">
      {/* {selectedProfile && isLocalProfile(selectedProfile) ? (
        <div className="flex items-center justify-center">
          <SecondaryButton
            className="flex flex-row items-center gap-1"
            onClick={() => {
              ideMessenger.post("config/openProfile", {
                profileId: selectedProfile.id,
              });
            }}
          >
            <span>Open</span>
            <span>Config</span>
            <span className="xs:flex hidden">File</span>
          </SecondaryButton>
        </div>
      ) : null} */}
      {hubEnabled ? (
        <div className="flex flex-col gap-4 py-4">
          <div>
            <h2 className="mb-2 mt-0 p-0">User settings</h2>
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
              isToggled={showChatScrollbar}
              onToggle={() =>
                handleUpdate({
                  showChatScrollbar: !showChatScrollbar,
                })
              }
              text="Show Chat Scrollbar"
            />
            <ToggleSwitch
              isToggled={readResponseTTS}
              onToggle={() =>
                handleUpdate({
                  readResponseTTS: !readResponseTTS,
                })
              }
              text="Text-to-Speech Output"
            />

            {/* <ToggleSwitch
                    isToggled={useChromiumForDocsCrawling}
                    onToggle={() =>
                      handleUpdate({
                        useChromiumForDocsCrawling: !useChromiumForDocsCrawling,
                      })
                    }
                    text="Use Chromium for Docs Crawling"
                  /> */}
            <ToggleSwitch
              isToggled={!disableSessionTitles}
              onToggle={() =>
                handleUpdate({
                  disableSessionTitles: !disableSessionTitles,
                })
              }
              text="Enable Session Titles"
            />
            <ToggleSwitch
              isToggled={!displayRawMarkdown}
              onToggle={() =>
                handleUpdate({
                  displayRawMarkdown: !displayRawMarkdown,
                })
              }
              text="Format Markdown"
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
              isToggled={!disableIndexing}
              onToggle={() =>
                handleUpdate({
                  disableIndexing: !disableIndexing,
                })
              }
              text="Enable Indexing"
            />

            {/* <ToggleSwitch
                    isToggled={useAutocompleteCache}
                    onToggle={() =>
                      handleUpdate({
                        useAutocompleteCache: !useAutocompleteCache,
                      })
                    }
                    text="Use Autocomplete Cache"
                  /> */}

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

            <label className="flex items-center justify-between gap-3">
              <span className="line-clamp-1 text-left">
                Multiline Autocompletions
              </span>
              <Select
                value={useAutocompleteMultilineCompletions}
                onChange={(e) =>
                  handleUpdate({
                    useAutocompleteMultilineCompletions: e.target.value as
                      | "auto"
                      | "always"
                      | "never",
                  })
                }
              >
                <option value="auto">Auto</option>
                <option value="always">Always</option>
                <option value="never">Never</option>
              </Select>
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
                    {formDisableAutocomplete !== disableAutocompleteInFiles ? (
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
      ) : null}
    </div>
  );
}
