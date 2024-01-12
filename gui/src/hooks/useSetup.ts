import { Dispatch } from "@reduxjs/toolkit";
import { useEffect } from "react";
import { setServerStatusMessage } from "../redux/slices/miscSlice";
import { errorPopup, isJetBrains, postToIde } from "../util/ide";

import {
  intermediateToFinalConfig,
  serializedToIntermediateConfig,
} from "core/config/load";
import { ExtensionIde } from "core/ide/index";
import { useSelector } from "react-redux";
import { VSC_THEME_COLOR_VARS } from "../components";
import { setVscMachineId } from "../redux/slices/configSlice";
import { setConfig, setInactive } from "../redux/slices/stateSlice";
import { RootStore } from "../redux/store";
import TransformersJsEmbeddingsProvider from "../util/TransformersJsEmbeddingsProvider";
import useChatHandler from "./useChatHandler";

function useSetup(dispatch: Dispatch<any>) {
  const loadConfig = async () => {
    try {
      const ide = new ExtensionIde();
      let serialized = await ide.getSerializedConfig();
      let intermediate = serializedToIntermediateConfig(serialized);

      const configJsUrl = await ide.getConfigJsUrl();
      if (configJsUrl) {
        try {
          // Try config.ts first
          const module = await import(configJsUrl);
          if (!module.modifyConfig) {
            throw new Error(
              "config.ts does not export a modifyConfig function."
            );
          }
          intermediate = module.modifyConfig(intermediate);
        } catch (e) {
          console.log("Error loading config.ts: ", e);
          errorPopup(e.message);
        }
      }
      const finalConfig = await intermediateToFinalConfig(
        intermediate,
        async (filepath) => {
          return new ExtensionIde().readFile(filepath);
        }
      );

      // Swap in web-version of TransformersJsEmbeddingsProvider
      if (
        (finalConfig.embeddingsProvider as any)?.providerName ===
        "transformers.js"
      ) {
        finalConfig.embeddingsProvider = new TransformersJsEmbeddingsProvider();
      }

      // Fall back to config.json
      dispatch(setConfig(finalConfig));
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

  const defaultModelTitle = useSelector(
    (store: RootStore) => store.state.defaultModelTitle
  );

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
