import { Dispatch } from "@reduxjs/toolkit";
import { useEffect } from "react";
import { setServerStatusMessage } from "../redux/slices/miscSlice";
import { postToIde } from "../util/ide";

import { setVscMachineId } from "../redux/slices/configSlice";
import { ExtensionIde } from "core/ide/index";
import { setConfig } from "../redux/slices/serverStateReducer";
import { addHighlightedCode, setInactive } from "../redux/slices/stateSlice";

function useSetup(dispatch: Dispatch<any>) {
  // Load config from the IDE
  useEffect(() => {
    new ExtensionIde().getSerializedConfig().then((config) => {
      dispatch(setConfig(config));
    });
  }, []);

  useEffect(() => {
    // Override persisted state
    dispatch(setInactive());

    // Tell JetBrains the webview is ready
    postToIde("onLoad", {});
  }, []);

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
        case "stopSession":
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
