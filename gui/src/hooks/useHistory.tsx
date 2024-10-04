import { Dispatch } from "@reduxjs/toolkit";
import { PersistedSessionInfo, SessionInfo } from "core";

import { stripImages } from "core/llm/images";
import { useContext } from "react";
import { useSelector } from "react-redux";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import { newSession } from "../redux/slices/stateSlice";
import { RootState } from "../redux/store";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";

function truncateText(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.slice(0, maxLength - 3) + "...";
  }
  return text;
}

function useHistory(dispatch: Dispatch) {
  const state = useSelector((state: RootState) => state.state);
  const defaultModel = useSelector(defaultModelSelector);
  const ideMessenger = useContext(IdeMessengerContext);

  async function getHistory(
    offset?: number,
    limit?: number,
  ): Promise<SessionInfo[]> {
    const result = await ideMessenger.request("history/list", {
      offset,
      limit,
    });
    return result.status === "success" ? result.content : [];
  }

  async function saveSession() {
    if (state.history.length === 0) return;

    const stateCopy = { ...state };
    dispatch(newSession());
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Set default title if it isn't set (=== "New Session"), if it is set then use that title, fallback use the first user message
    let title =
      stateCopy.title === "New Session"
        ? truncateText(
            stripImages(stateCopy.history[0].message.content)
              .split("\n")
              .filter((l) => l.trim() !== "")
              .slice(-1)[0] || "",
            50,
          )
        : stateCopy.title?.length > 0
        ? stateCopy.title
        : (await getSession(stateCopy.sessionId)).title; // to ensure titles are synced with updates from history page.

    const sessionInfo: PersistedSessionInfo = {
      history: stateCopy.history,
      title: title,
      sessionId: stateCopy.sessionId,
      workspaceDirectory: window.workspacePaths?.[0] || "",
    };
    setLocalStorage("lastSessionId", stateCopy.sessionId);
    return await ideMessenger.request("history/save", sessionInfo);
  }

  async function getSession(id: string): Promise<PersistedSessionInfo> {
    const result = await ideMessenger.request("history/load", { id });
    if (result.status === "error") {
      throw new Error(result.error);
    }
    return result.content;
  }

  async function updateSession(sessionInfo: PersistedSessionInfo) {
    return await ideMessenger.request("history/save", sessionInfo);
  }

  async function deleteSession(id: string) {
    return await ideMessenger.request("history/delete", { id });
  }

  async function loadSession(id: string): Promise<PersistedSessionInfo> {
    setLocalStorage("lastSessionId", state.sessionId);
    const result = await ideMessenger.request("history/load", { id });
    if (result.status === "error") {
      throw new Error(result.error);
    }
    const json = result.content;
    dispatch(newSession(json));
    return json;
  }

  async function loadLastSession(): Promise<PersistedSessionInfo | undefined> {
    const lastSessionId = getLocalStorage("lastSessionId");
    if (lastSessionId) {
      return await loadSession(lastSessionId);
    }
  }

  function getLastSessionId(): string | undefined {
    return getLocalStorage("lastSessionId");
  }

  return {
    getHistory,
    saveSession,
    deleteSession,
    loadSession,
    loadLastSession,
    getLastSessionId,
    updateSession,
    getSession,
  };
}

export default useHistory;
