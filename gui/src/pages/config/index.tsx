import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useNavigationListener } from "../../hooks/useNavigationListener";
import PageHeader from "../../components/PageHeader";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  modifyContinueConfigWithSharedConfig,
  SharedConfigSchema,
} from "core/config/sharedConfig";
import { updateConfig } from "../../redux/slices/configSlice";
import ToggleSwitch from "../../components/gui/Switch";
import { useAuth } from "../../context/Auth";
import { Button, Input } from "../../components";
import { getFontSize } from "../../util";
import NumberInput from "../../components/gui/NumberInput";
import { Select } from "../../components/gui/Select";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

function ConfigPage() {
  useNavigationListener();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const { selectedProfile } = useAuth();
  const config = useAppSelector((state) => state.config.config);

  function handleUpdate(sharedConfig: Partial<SharedConfigSchema>) {
    dispatch(
      updateConfig(modifyContinueConfigWithSharedConfig(config, sharedConfig)),
    );
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

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

  function handleOpenConfig() {
    if (!selectedProfile) {
      return;
    }
    ideMessenger.post("config/openProfile", {
      profileId: selectedProfile.id,
    });
  }

  return (
    <div className="overflow-y-scroll px-2">
      <PageHeader onClick={() => navigate("/")} title="Chat" />
      <h1 className="text-center">Continue Config</h1>

      {!selectedProfile ? (
        <p className="text-center">No config profile selected</p>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-3">
          <div>
            <Button onClick={handleOpenConfig}>
              {selectedProfile.id === "local" ? "Open Config File" : "Nooooo"}
            </Button>
          </div>
          <h2 className="text-center">Other Settings</h2>
          <div className="flex flex-col items-end gap-2">
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

            <label className="flex items-center justify-end gap-3">
              <span className="text-right">Codeblock Actions Position</span>
              <Select
                value={codeBlockToolbarPosition}
                onChange={(e) =>
                  handleUpdate({
                    codeBlockToolbarPosition: e.target.value as
                      | "top"
                      | "bottom",
                  })
                }
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </Select>
            </label>

            <label className="flex items-center justify-end gap-3">
              <span className="text-right">Multiline Autocompletions</span>
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

            <label className="flex items-center justify-end gap-3">
              <span className="text-right">Font Size</span>
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
              className="flex flex-col items-end gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitPromptPath();
              }}
            >
              <label className="flex flex-row items-center justify-end gap-3">
                <span className="text-right">Workspace prompts path</span>
                <Input
                  value={formPromptPath}
                  className="max-w-[100px]"
                  onChange={(e) => {
                    setFormPromptPath(e.target.value);
                  }}
                />
                <div className="flex h-full flex-col">
                  {formPromptPath !== promptPath ? (
                    <>
                      <div
                        onClick={handleSubmitPromptPath}
                        className="cursor-pointer"
                      >
                        <CheckIcon className="h-4 w-4 text-green-500 hover:opacity-80" />
                      </div>
                      <div
                        onClick={cancelChangePromptPath}
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
              </label>
            </form>

            <form
              className="flex flex-col items-end gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                handleDisableAutocompleteSubmit();
              }}
            >
              <label className="flex flex-row items-center justify-end gap-3">
                <span className="text-right">
                  Disable autocomplete in files
                </span>
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
              </label>
              <span className="text-vsc-foreground-muted text-xs">
                Comma-separated list of path matchers
              </span>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigPage;
