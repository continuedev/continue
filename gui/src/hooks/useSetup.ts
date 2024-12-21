import { useCallback, useContext, useEffect, useRef } from "react";
import { VSC_THEME_COLOR_VARS } from "../components";
import { IdeMessengerContext } from "../context/IdeMessenger";

import { BrowserSerializedContinueConfig } from "core";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setConfig, setConfigError } from "../redux/slices/configSlice";
import { updateIndexingStatus } from "../redux/slices/indexingSlice";
import { updateDocsSuggestions } from "../redux/slices/miscSlice";
import {
  addContextItemsAtIndex,
  setInactive,
  setSelectedProfileId,
} from "../redux/slices/sessionSlice";
import { setTTSActive } from "../redux/slices/uiSlice";
import { refreshSessionMetadata } from "../redux/thunks/session";
import { streamResponseThunk } from "../redux/thunks/streamResponse";
import { updateFileSymbolsFromHistory } from "../redux/thunks/updateFileSymbols";
import { isJetBrains } from "../util";
import { setLocalStorage } from "../util/localStorage";
import { useWebviewListener } from "./useWebviewListener";

function useSetup() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const history = useAppSelector((store) => store.session.history);
  const defaultModelTitle = useAppSelector(
    (store) => store.config.defaultModelTitle,
  );

  const hasLoadedConfig = useRef(false);

  const handleConfigUpdate = useCallback(
    async (
      initial: boolean,
      result: { config: BrowserSerializedContinueConfig; profileId: string },
    ) => {
      const { config, profileId } = result;
      if (initial && hasLoadedConfig.current) {
        return;
      }
      hasLoadedConfig.current = true;
      dispatch(setConfig(config));
      dispatch(setSelectedProfileId(profileId));

      // Perform any actions needed with the config
      if (config.ui?.fontSize) {
        setLocalStorage("fontSize", config.ui.fontSize);
        document.body.style.fontSize = `${config.ui.fontSize}px`;
      }
    },
    [dispatch, hasLoadedConfig],
  );

  const loadConfig = useCallback(
    async (initial: boolean) => {
      const result = await ideMessenger.request(
        "config/getSerializedProfileInfo",
        undefined,
      );
      if (result.status === "error") {
        return;
      }
      await handleConfigUpdate(initial, result.content);
    },
    [ideMessenger, handleConfigUpdate],
  );

  // Load config from the IDE
  useEffect(() => {
    loadConfig(true);
    const interval = setInterval(() => {
      if (hasLoadedConfig.current) {
        // Init to run on initial config load
        ideMessenger.post("docs/getSuggestedDocs", undefined);
        ideMessenger.post("docs/initStatuses", undefined);
        dispatch(updateFileSymbolsFromHistory());
        dispatch(refreshSessionMetadata({}));

        // This triggers sending pending status to the GUI for relevant docs indexes
        clearInterval(interval);
        return;
      }
      loadConfig(true);
    }, 2_000);

    return () => clearInterval(interval);
  }, [hasLoadedConfig, loadConfig, ideMessenger]);

  useWebviewListener(
    "configUpdate",
    async (update) => {
      if (!update) {
        return;
      }
      await handleConfigUpdate(false, update);
    },
    [loadConfig],
  );

  // Load symbols for chat on any session change
  const sessionId = useAppSelector((state) => state.session.id);
  useEffect(() => {
    if (sessionId) {
      dispatch(updateFileSymbolsFromHistory());
    }
  }, [sessionId]);

  // ON LOAD
  useEffect(() => {
    // Override persisted state
    dispatch(setInactive());

    if (isJetBrains()) {
      // Save theme colors to local storage for immediate loading in JetBrains
      ideMessenger.request("jetbrains/getColors", undefined).then((result) => {
        Object.keys(result).forEach((key) => {
          document.body.style.setProperty(key, result[key]);
          document.documentElement.style.setProperty(key, result[key]);
        });
      });

      // Tell JetBrains the webview is ready
      ideMessenger.request("jetbrains/onLoad", undefined).then((result) => {
        if (result.status === "error") {
          return;
        }

        const msg = result.content;
        (window as any).windowId = msg.windowId;
        (window as any).serverUrl = msg.serverUrl;
        (window as any).workspacePaths = msg.workspacePaths;
        (window as any).vscMachineId = msg.vscMachineId;
        (window as any).vscMediaUrl = msg.vscMediaUrl;
      });

      for (const colorVar of VSC_THEME_COLOR_VARS) {
        if (document.body.style.getPropertyValue(colorVar)) {
          localStorage.setItem(
            colorVar,
            document.body.style.getPropertyValue(colorVar),
          );
        }
      }
    }
  }, []);

  useWebviewListener("docs/suggestions", async (data) => {
    dispatch(updateDocsSuggestions(data));
  });

  // IDE event listeners
  useWebviewListener(
    "getWebviewHistoryLength",
    async () => {
      return history.length;
    },
    [history],
  );

  useWebviewListener(
    "getCurrentSessionId",
    async () => {
      return sessionId;
    },
    [sessionId],
  );

  useWebviewListener("setInactive", async () => {
    dispatch(setInactive());
  });

  useWebviewListener("setTTSActive", async (status) => {
    dispatch(setTTSActive(status));
  });

  useWebviewListener("configError", async (error) => {
    dispatch(setConfigError(error));
  });

  // TODO - remove?
  useWebviewListener("submitMessage", async (data) => {
    dispatch(
      streamResponseThunk({
        editorState: data.message,
        modifiers: { useCodebase: false, noContext: true },
      }),
    );
  });

  useWebviewListener("addContextItem", async (data) => {
    dispatch(
      addContextItemsAtIndex({
        index: data.historyIndex,
        contextItems: [data.item],
      }),
    );
  });

  useWebviewListener("indexing/statusUpdate", async (data) => {
    dispatch(updateIndexingStatus(data));
  });

  useWebviewListener(
    "getDefaultModelTitle",
    async () => {
      return defaultModelTitle;
    },
    [defaultModelTitle],
  );
}

export default useSetup;
