import { Dispatch } from "@reduxjs/toolkit";
import { useCallback, useContext, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { VSC_THEME_COLOR_VARS } from "../components";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { setVscMachineId } from "../redux/slices/configSlice";
import {
  addContextItemsAtIndex,
  setConfig,
  setConfigError,
  setInactive,
  setSelectedProfileId,
  setTTSActive,
  updateDocsSuggestions,
  updateIndexingStatus,
} from "../redux/slices/stateSlice";
import { RootState } from "../redux/store";

import { isJetBrains } from "../util";
import { setLocalStorage } from "../util/localStorage";
import useChatHandler from "./useChatHandler";
import { useWebviewListener } from "./useWebviewListener";
import { updateFileSymbolsFromContextItems } from "../util/symbols";

function useSetup(dispatch: Dispatch) {
  const ideMessenger = useContext(IdeMessengerContext);
  const history = useSelector((store: RootState) => store.state.history);

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
        // Docs init on config load
        ideMessenger.post("docs/getSuggestedDocs", undefined);
        ideMessenger.post("docs/initStatuses", undefined);

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
  const sessionId = useSelector((store: RootState) => store.state.sessionId);
  const sessionIdRef = useRef("");
  useEffect(() => {
    if (sessionIdRef.current !== sessionId) {
      updateFileSymbolsFromContextItems(
        history.flatMap((item) => item.contextItems),
        ideMessenger,
        dispatch,
      );
    }
    sessionIdRef.current = sessionId;
  }, [sessionId, history, ideMessenger, dispatch]);

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
      dispatch(setVscMachineId(msg.vscMachineId));
      // dispatch(setVscMediaUrl(msg.vscMediaUrl));
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

  const { streamResponse } = useChatHandler(dispatch, ideMessenger);

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
    streamResponse(
      data.message,
      { useCodebase: false, noContext: true },
      ideMessenger,
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

  const defaultModelTitle = useSelector(
    (store: RootState) => store.state.defaultModelTitle,
  );

  useWebviewListener(
    "getDefaultModelTitle",
    async () => {
      return defaultModelTitle;
    },
    [defaultModelTitle],
  );
}

export default useSetup;
