import { Dispatch } from "@reduxjs/toolkit";
import ContinueGUIClientProtocol from "./ContinueGUIClientProtocol";
import { useCallback, useEffect, useState } from "react";
import {
  addContextItem,
  addHighlightedCode,
  processSessionUpdate,
  setActive,
  setTitle,
} from "../redux/slices/sessionStateReducer";
import { setServerStatusMessage } from "../redux/slices/miscSlice";
import { postToIde } from "../vscode";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import {
  setConfig,
  setContextProviders,
  setSlashCommands,
} from "../redux/slices/serverStateReducer";

function useSetup(
  client: ContinueGUIClientProtocol | undefined,
  dispatch: Dispatch<any>
) {
  const serverUrl = useSelector((store: RootStore) => store.config.apiUrl);
  const active = useSelector((store: RootStore) => store.sessionState.active);
  const title = useSelector((store: RootStore) => store.sessionState.title);
  const history = useSelector((store: RootStore) => store.sessionState.history);

  const [requestedTitle, setRequestedTitle] = useState(false);

  useEffect(() => {
    // Override persisted state
    dispatch(setActive(false));
  }, []);

  useEffect(() => {
    (async () => {
      if (
        client &&
        !requestedTitle &&
        !active &&
        title === "New Session" &&
        history.filter((step) => !step.hide).length >= 2
      ) {
        setRequestedTitle(true);
        const title = await client.getSessionTitle(history);
        dispatch(setTitle(title));
      }
    })();
  }, [active, history, title, client, requestedTitle]);

  // Setup requiring client
  useEffect(() => {
    if (!client) return;

    // Listen for updates to the session state
    client.onSessionUpdate((update) => {
      dispatch(processSessionUpdate(update));
    });

    client.onAddContextItem((item) => {
      dispatch(addContextItem(item));
    });

    client.onConfigUpdate((config) => {
      dispatch(setConfig(config));
    });

    fetch(`${serverUrl}/slash_commands`).then(async (resp) => {
      const sc = await resp.json();
      dispatch(setSlashCommands(sc));
    });
    fetch(`${serverUrl}/context_providers`).then(async (resp) => {
      const cp = await resp.json();
      dispatch(setContextProviders(cp));
    });
    client.getConfig().then((config) => {
      dispatch(setConfig(config));
    });
  }, [client]);

  // IDE event listeners
  useEffect(() => {
    const eventListener = (event: any) => {
      switch (event.data.type) {
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
          client?.stopSession();
          break;
      }
    };
    window.addEventListener("message", eventListener);
    return () => window.removeEventListener("message", eventListener);
  }, [client]);

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
