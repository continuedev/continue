import { useCallback, useContext, useEffect, useRef } from "react";
import { VSC_THEME_COLOR_VARS } from "../components";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { AppDispatch } from "../redux/store";

import { streamResponseThunk } from "../redux/thunks/streamResponse";
import { isJetBrains } from "../util";
import { setLocalStorage } from "../util/localStorage";
import { useWebviewListener } from "./useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setConfig, setConfigError } from "../redux/slices/configSlice";
import { updateIndexingStatus } from "../redux/slices/indexingSlice";
import { updateDocsSuggestions } from "../redux/slices/miscSlice";
import {
  setSelectedProfileId,
  setInactive,
  addContextItemsAtIndex,
} from "../redux/slices/sessionSlice";
import { setTTSActive } from "../redux/slices/uiSlice";
import useUpdatingRef from "./useUpdatingRef";
import { updateFileSymbolsFromHistory } from "../redux/thunks/updateFileSymbols";
import { refreshSessionMetadata } from "../redux/thunks/session";

function useSetup() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const history = useAppSelector((store) => store.session.history);
  const defaultModelTitle = useAppSelector(
    (store) => store.config.defaultModelTitle,
  );

  const hasLoadedConfig = useRef(false);
  const loadConfig = useCallback(
    async (initial: boolean) => {
      const result = await ideMessenger.request(
        "config/getSerializedProfileInfo",
        undefined,
      );
      if (result.status === "error") {
        return;
      }
      const { config, profileId } = result.content;
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
    [dispatch, ideMessenger, hasLoadedConfig],
  );

  // Load config from the IDE
  useEffect(() => {
    loadConfig(true);
    const interval = setInterval(() => {
      if (hasLoadedConfig.current) {
        // Init to run on initial config load
        ideMessenger.post("docs/getSuggestedDocs", undefined);
        ideMessenger.post("docs/initStatuses", undefined);
        dispatch(updateFileSymbolsFromHistory())
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
    async () => {
      await loadConfig(false);
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

    // Tell JetBrains the webview is ready
    ideMessenger.request("onLoad", undefined).then((result) => {
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

    // Save theme colors to local storage for immediate loading in JetBrains
    if (isJetBrains()) {
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

  useWebviewListener("setInactive", async () => {
    dispatch(setInactive());
  });

  useWebviewListener("setTTSActive", async (status) => {
    dispatch(setTTSActive(status));
  });

  useWebviewListener("setColors", async (colors) => {
    Object.keys(colors).forEach((key) => {
      document.body.style.setProperty(key, colors[key]);
      document.documentElement.style.setProperty(key, colors[key]);
    });
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
