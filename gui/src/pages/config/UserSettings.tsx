import { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";

import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import {
  SharedConfigSchema,
  modifyContinueConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { Input } from "../../components";
import NumberInput from "../../components/gui/NumberInput";
import { Select } from "../../components/gui/Select";
import ToggleSwitch from "../../components/gui/Switch";
import { updateConfig } from "../../redux/slices/configSlice";
import { getFontSize } from "../../util";

function UserSettingsUI() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const config = useAppSelector((state) => state.config.config);

  function handleUpdate(sharedConfig: Partial<SharedConfigSchema>) {
    dispatch(
      updateConfig(modifyContinueConfigWithSharedConfig(config, sharedConfig)),
    );
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  // TODO defaults are in multiple places, should be consolidated and probably not explicit here
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

  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h2 className="mb-2 mt-0">User settings</h2>
      </div>

      <div className="flex flex-col gap-4">
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
          <span className="text-right">Codeblock Actions Position</span>
          <Select
            value={codeBlockToolbarPosition}
            onChange={(e) =>
              handleUpdate({
                codeBlockToolbarPosition: e.target.value as "top" | "bottom",
              })
            }
          >
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
          </Select>
        </label>

        <label className="flex items-center justify-between gap-3">
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

        <label className="flex items-center justify-between gap-3">
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
          className="flex flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitPromptPath();
          }}
        >
          <div className="flex items-center justify-between">
            <span>Workspace prompts path</span>
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        </form>
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
          <span className="text-vsc-foreground-muted self-end text-xs">
            Comma-separated list of path matchers
          </span>
        </form>
      </div>
    </div>
  );
}

export default UserSettingsUI;
