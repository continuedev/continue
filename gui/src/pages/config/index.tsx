import { useContext, useState } from "react";
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
import { Button } from "../../components";
import { getFontSize } from "../../util";
import NumberInput from "../../components/gui/NumberInput";
import { Select } from "../../components/gui/Select";

function ConfigPage() {
  useNavigationListener();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const { profiles, selectedProfile, controlServerBetaEnabled } = useAuth();
  const config = useAppSelector((state) => state.config.config);

  function handleUpdate(sharedConfig: Partial<SharedConfigSchema>) {
    dispatch(
      updateConfig(modifyContinueConfigWithSharedConfig(config, sharedConfig)),
    );
    ideMessenger.post("config/updateSharedConfig", sharedConfig);

    // TODO: Optimistic update in redux
    // dispatch(updateConfig({
    //   ...config,
    //   ...(sharedConfig.)
    // }))
  }

  // Account for default values
  // TODO - duplicate defaults here, should consolidate defaults to one place
  // And write defaults earlier in the config process
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
        <p>No config profile selected</p>
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

            {/* disableAutocompleteInFiles: z.array(z.string()), */}

            {/* promptPath: z.string(), */}

            {/* Other */}
            <ToggleSwitch
              isToggled={useAutocompleteCache}
              onToggle={() =>
                handleUpdate({
                  useAutocompleteCache: !useAutocompleteCache,
                })
              }
              text="Use Autocomplete Cache"
            />

            {/* Other */}
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
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigPage;
