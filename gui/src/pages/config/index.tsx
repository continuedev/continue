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
import { Switch } from "@headlessui/react";
import { updateConfig } from "../../redux/slices/configSlice";
import ToggleSwitch from "../../components/gui/Switch";
import { useAuth } from "../../context/Auth";
import { Button } from "../../components";

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
      <h1 className="text-center">Continue Configuration</h1>

      {!selectedProfile ? (
        <p>No config profile selected</p>
      ) : (
        <div className="flex flex-col gap-2 px-3">
          <Button onClick={handleOpenConfig}>
            {selectedProfile.id === "local" ? "Open Config File" : "Nooooo"}
          </Button>
          <h2 className="text-center">Other Settings</h2>
          <ToggleSwitch
            isToggled={codeWrap}
            onToggle={() =>
              handleUpdate({
                codeWrap: !codeWrap,
              })
            }
            text="Wrap Codeblocks"
          ></ToggleSwitch>
          <ToggleSwitch
            isToggled={displayRawMarkdown}
            onToggle={() =>
              handleUpdate({
                displayRawMarkdown: !displayRawMarkdown,
              })
            }
            text="Display Raw Markdown"
          ></ToggleSwitch>
          <ToggleSwitch
            isToggled={allowAnonymousTelemetry}
            onToggle={() =>
              handleUpdate({
                allowAnonymousTelemetry: !allowAnonymousTelemetry,
              })
            }
            text="Allow Anonymous Telemetry"
          ></ToggleSwitch>
          <ToggleSwitch
            isToggled={disableIndexing}
            onToggle={() =>
              handleUpdate({
                disableIndexing: !disableIndexing,
              })
            }
            text="Disable Indexing"
          ></ToggleSwitch>

          <ToggleSwitch
            isToggled={disableSessionTitles}
            onToggle={() =>
              handleUpdate({
                disableSessionTitles: !disableSessionTitles,
              })
            }
            text="Disable Session Titles"
          ></ToggleSwitch>

          <ToggleSwitch
            isToggled={readResponseTTS}
            onToggle={() =>
              handleUpdate({
                readResponseTTS: !readResponseTTS,
              })
            }
            text="Read Response TTS"
          ></ToggleSwitch>

          <ToggleSwitch
            isToggled={showChatScrollbar}
            onToggle={() =>
              handleUpdate({
                showChatScrollbar: !showChatScrollbar,
              })
            }
            text="Show Chat Scrollbar"
          ></ToggleSwitch>

          {/* <label>
          fontSize
          <input></input>
        </label> */}

          {/* codeBlockToolbarPosition: z.enum(["top", "bottom"]), */}

          {/* disableAutocompleteInFiles: z.array(z.string()), */}

          {/* promptPath: z.string(), */}

          {/* useAutocompleteMultilineCompletions: z.enum(["always", "never", "auto"]), */}

          {/* Other */}
          <ToggleSwitch
            isToggled={useAutocompleteCache}
            onToggle={() =>
              handleUpdate({
                useAutocompleteCache: !useAutocompleteCache,
              })
            }
            text="Use Chromium for Docs Crawling"
          ></ToggleSwitch>

          {/* Other */}
          <ToggleSwitch
            isToggled={useChromiumForDocsCrawling}
            onToggle={() =>
              handleUpdate({
                useChromiumForDocsCrawling: !useChromiumForDocsCrawling,
              })
            }
            text="Use Chromium for Docs Crawling"
          ></ToggleSwitch>
        </div>
      )}
    </div>
  );
}

export default ConfigPage;
