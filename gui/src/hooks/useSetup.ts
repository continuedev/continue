import { Dispatch } from "@reduxjs/toolkit";
import { useEffect } from "react";
import { setServerStatusMessage } from "../redux/slices/miscSlice";
import { errorPopup, postToIde } from "../util/ide";

import { loadSerializedConfig } from "core/config/load";
import { ExtensionIde } from "core/ide/index";
import { setVscMachineId } from "../redux/slices/configSlice";
import {
  addHighlightedCode,
  setConfig,
  setInactive,
} from "../redux/slices/stateSlice";
import useChatHandler from "./useChatHandler";

function useSetup(dispatch: Dispatch<any>) {
  const loadConfig = async () => {
    try {
      const ide = new ExtensionIde();
      let config = loadSerializedConfig(await ide.getSerializedConfig());
      // const configJsUrl = await ide.getConfigJsUrl();
      // if (configJsUrl) {
      //   try {
      //     // Try config.ts first
      //     const module = await import(configJsUrl);
      //     if (!module.config) {
      //       throw new Error("config.ts does not export a config object");
      //     }
      //     console.log("Loaded config.ts", module.config);
      //     config = module.modifyConfig(config);
      //   } catch (e) {
      //     console.log("Error loading config.ts: ", e);
      //     errorPopup(e.message);
      //   }
      // }
      console.log("Loaded config.json", config);
      // Fall back to config.json
      dispatch(setConfig(config));
    } catch (e) {
      console.log("Error loading config.json: ", e);
      errorPopup(e.message);
    }
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

  // IDE event listeners
  useEffect(() => {
    const eventListener = (event: any) => {
      switch (event.data.type) {
        case "onLoad":
          (window as any).windowId = event.data.windowId;
          (window as any).serverUrl = event.data.serverUrl;
          (window as any).workspacePaths = event.data.workspacePaths;
          (window as any).vscMachineId = event.data.vscMachineId;
          (window as any).vscMediaUrl = event.data.vscMediaUrl;
          dispatch(setVscMachineId(event.data.vscMachineId));
          // dispatch(setVscMediaUrl(event.data.vscMediaUrl));

          break;
        case "highlightedCode":
          dispatch(
            addHighlightedCode({
              rangeInFileWithContents: event.data.rangeInFileWithContents,
              edit: event.data.edit,
            })
          );
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
      }
    };
    window.addEventListener("message", eventListener);
    return () => window.removeEventListener("message", eventListener);
  }, []);

  // Save theme colors to local storage
  useEffect(() => {
    if (document.body.style.getPropertyValue("--vscode-editor-foreground")) {
      localStorage.setItem(
        "--vscode-editor-foreground",
        document.body.style.getPropertyValue("--vscode-editor-foreground")
      );
    }
    if (document.body.style.getPropertyValue("--vscode-editor-background")) {
      localStorage.setItem(
        "--vscode-editor-background",
        document.body.style.getPropertyValue("--vscode-editor-background")
      );
    }
    if (document.body.style.getPropertyValue("--vscode-list-hoverBackground")) {
      localStorage.setItem(
        "--vscode-list-hoverBackground",
        document.body.style.getPropertyValue("--vscode-list-hoverBackground")
      );
    }
  }, []);
}

export default useSetup;
