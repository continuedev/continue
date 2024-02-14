import { Dispatch } from "@reduxjs/toolkit";
import { useEffect } from "react";
import { setServerStatusMessage } from "../redux/slices/miscSlice";
import { isJetBrains, postToIde } from "../util/ide";

import { ExtensionIde } from "core/ide/index";
import { useSelector } from "react-redux";
import { VSC_THEME_COLOR_VARS } from "../components";
import { setVscMachineId } from "../redux/slices/configSlice";
import {
  addContextItemsAtIndex,
  setConfig,
  setInactive,
} from "../redux/slices/stateSlice";
import { RootStore } from "../redux/store";
import useChatHandler from "./useChatHandler";

function useSetup(dispatch: Dispatch<any>) {
  const loadConfig = async () => {
    dispatch(setConfig(await new ExtensionIde().getSerializedConfig()));
  };

  // Load config from the IDE
  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    // Override persisted state
    dispatch(setInactive());

    // Tell JetBrains the webview is ready
    postToIde("onLoad", {});
  }, []);

  const { streamResponse } = useChatHandler(dispatch);

  const defaultModelTitle = useSelector(
    (store: RootStore) => store.state.defaultModelTitle
  );

  // IDE event listeners
  useEffect(() => {
    const eventListener = (event: any) => {
      switch (event.data.type) {
        case "onLoad":
          window.windowId = event.data.windowId;
          window.serverUrl = event.data.serverUrl;
          window.workspacePaths = event.data.workspacePaths;
          window.vscMachineId = event.data.vscMachineId;
          window.vscMediaUrl = event.data.vscMediaUrl;
          dispatch(setVscMachineId(event.data.vscMachineId));
          // dispatch(setVscMediaUrl(event.data.vscMediaUrl));

          break;
        case "serverStatus":
          dispatch(setServerStatusMessage(event.data.message));
          break;
        case "setInactive":
          dispatch(setInactive());
          break;
        case "configUpdate":
          loadConfig();
          break;
        case "submitMessage":
          streamResponse(event.data.message);
          break;
        case "addContextItem":
          dispatch(
            addContextItemsAtIndex({
              index: event.data.message.historyIndex,
              contextItems: [event.data.message.item],
            })
          );
          break;
        case "getDefaultModelTitle":
          postToIde("getDefaultModelTitle", { defaultModelTitle });
          break;
      }
    };
    window.addEventListener("message", eventListener);
    return () => window.removeEventListener("message", eventListener);
  }, [defaultModelTitle]);

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
