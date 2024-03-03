import { Dispatch } from "@reduxjs/toolkit";
import { useEffect } from "react";
import { useSelector } from "react-redux";
import { VSC_THEME_COLOR_VARS } from "../components";
import { setVscMachineId } from "../redux/slices/configSlice";
import {
  addContextItemsAtIndex,
  setConfig,
  setInactive,
} from "../redux/slices/stateSlice";
import { RootState } from "../redux/store";
import { ideRequest, isJetBrains } from "../util/ide";
import useChatHandler from "./useChatHandler";
import { useWebviewListener } from "./useWebviewListener";

function useSetup(dispatch: Dispatch<any>) {
  const loadConfig = async () => {
    const config = await ideRequest("config/getBrowserSerialized", undefined);
    dispatch(setConfig(config));
  };

  // Load config from the IDE
  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    // Override persisted state
    dispatch(setInactive());

    // Tell JetBrains the webview is ready
    ideRequest("onLoad", undefined).then((msg) => {
      (window as any).windowId = msg.windowId;
      (window as any).serverUrl = msg.serverUrl;
      (window as any).workspacePaths = msg.workspacePaths;
      (window as any).vscMachineId = msg.vscMachineId;
      (window as any).vscMediaUrl = msg.vscMediaUrl;
      dispatch(setVscMachineId(msg.vscMachineId));
      // dispatch(setVscMediaUrl(msg.vscMediaUrl));
    });
  }, []);

  const { streamResponse } = useChatHandler(dispatch);

  const defaultModelTitle = useSelector(
    (store: RootState) => store.state.defaultModelTitle
  );

  // IDE event listeners
  useWebviewListener("setInactive", async () => {
    dispatch(setInactive());
  });

  useWebviewListener("setColors", async (colors) => {
    Object.keys(colors).forEach((key) => {
      document.body.style.setProperty(key, colors[key]);
    });
  });

  useWebviewListener("configUpdate", async () => {
    loadConfig();
  });

  useWebviewListener("submitMessage", async (data) => {
    streamResponse(data.message);
  });

  useWebviewListener("addContextItem", async (data) => {
    dispatch(
      addContextItemsAtIndex({
        index: data.historyIndex,
        contextItems: [data.item],
      })
    );
  });

  useWebviewListener(
    "getDefaultModelTitle",
    async () => {
      return defaultModelTitle;
    },
    [defaultModelTitle]
  );

  // Save theme colors to local storage for immediate loading in JetBrains
  useEffect(() => {
    if (isJetBrains()) {
      for (const colorVar of VSC_THEME_COLOR_VARS) {
        if (document.body.style.getPropertyValue(colorVar)) {
          localStorage.setItem(
            colorVar,
            document.body.style.getPropertyValue(colorVar)
          );
        }
      }
    }
  }, []);
}

export default useSetup;
