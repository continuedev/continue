import { Dispatch } from "@reduxjs/toolkit";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
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
} from "../redux/slices/stateSlice";
import { RootState } from "../redux/store";

import { debounce } from "lodash";
import { isJetBrains } from "../util";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";
import useChatHandler from "./useChatHandler";
import { useWebviewListener } from "./useWebviewListener";

function useSetup(dispatch: Dispatch<any>) {
  const ideMessenger = useContext(IdeMessengerContext);

  const initialConfigLoad = useRef(false);
  const loadConfig = useCallback(async () => {
    const result = await ideMessenger.request(
      "config/getSerializedProfileInfo",
      undefined,
    );
    if (result.status === "error") {
      return;
    }
    const { config, profileId } = result.content;
    dispatch(setConfig(config));
    dispatch(setSelectedProfileId(profileId));
    initialConfigLoad.current = true;
    setLocalStorage("disableIndexing", config.disableIndexing || false);

    // Perform any actions needed with the config
    if (config.ui?.fontSize) {
      setLocalStorage("fontSize", config.ui.fontSize);
      document.body.style.fontSize = `${config.ui.fontSize}px`;
    }
  }, [dispatch, ideMessenger, initialConfigLoad]);

  // Load config from the IDE
  useEffect(() => {
    loadConfig();
    const interval = setInterval(() => {
      if (initialConfigLoad.current) {
        clearInterval(interval);
        return;
      }
      loadConfig();
    }, 2_000);

    return () => clearInterval(interval);
  }, [initialConfigLoad, loadConfig]);

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
  }, []);

  const { streamResponse } = useChatHandler(dispatch, ideMessenger);

  const defaultModelTitle = useSelector(
    (store: RootState) => store.state.defaultModelTitle,
  );

  // IDE event listeners
  const history = useSelector((store: RootState) => store.state.history);
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

  const debouncedIndexDocs = debounce(() => {
    ideMessenger.post("context/indexDocs", { reIndex: false });
  }, 1000);

  useWebviewListener("configUpdate", async () => {
    await loadConfig();

    if (!isJetBrains && !getLocalStorage("disableIndexing")) {
      debouncedIndexDocs();
    }
  });

  useWebviewListener("configError", async (error) => {
    dispatch(setConfigError(error));
  });

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

  useWebviewListener(
    "getDefaultModelTitle",
    async () => {
      return defaultModelTitle;
    },
    [defaultModelTitle],
  );

  // Save theme colors to local storage for immediate loading in JetBrains
  useEffect(() => {
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
}

export default useSetup;
