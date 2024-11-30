import { Dispatch } from "@reduxjs/toolkit";
import { Session, SessionMetadata } from "core";
import { renderChatMessage } from "core/util/messageContent";
import { useCallback, useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useLastSessionContext } from "../context/LastSessionContext";
import { newSession, updateSessionTitle } from "../redux/slices/sessionSlice";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";
import { useAppSelector } from "../redux/hooks";

const MAX_TITLE_LENGTH = 100;

function truncateText(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.slice(0, maxLength - 3) + "...";
  }
  return text;
}

function useHistory(dispatch: Dispatch) {
  const sessionId = useAppSelector((store) => store.session.id);
  const config = useAppSelector((store) => store.config.config);
  const history = useAppSelector((store) => store.session.messages);
  const title = useAppSelector((store) => store.session.title);
  const ideMessenger = useContext(IdeMessengerContext);
  const { lastSessionId, setLastSessionId } = useLastSessionContext();

  const updateLastSessionId = useCallback((sessionId: string) => {
    setLastSessionId(sessionId);
    setLocalStorage("lastSessionId", sessionId);
  }, []);

  async function getHistory(
    offset?: number,
    limit?: number,
  ): Promise<SessionMetadata[]> {
    const result = await ideMessenger.request("history/list", {
      offset,
      limit,
    });
    return result.status === "success" ? result.content : [];
  }

  async function getChatTitle(message?: string): Promise<string | undefined> {
    const result = await ideMessenger.request(
      "chatDescriber/describe",
      message,
    );
    return result.status === "success" ? result.content : undefined;
  }

  async function saveSession(openNewSession: boolean = true) {
    if (history.length === 0) return;

    let currentTitle = title;
    if (config?.ui?.getChatTitles && currentTitle === "New Session") {
      try {
        // Check if we have first assistant response
        let assistantResponse = history
          ?.filter((h) => h.message.role === "assistant")[0]
          ?.message?.content?.toString();

        if (assistantResponse) {
          currentTitle = await getChatTitle(assistantResponse);
        }
      } catch (e) {
        throw new Error("Unable to get chat title");
      }
    }

    // Fallback if we get an error above or if the user has not set getChatTitles
    let newTitle =
      currentTitle === "New Session"
        ? truncateText(
            renderChatMessage(history[0].message)
              .split("\n")
              .filter((l) => l.trim() !== "")
              .slice(-1)[0] || "",
            MAX_TITLE_LENGTH,
          )
        : currentTitle?.length > 0
          ? currentTitle
          : (await getSession(sessionId)).title; // to ensure titles are synced with updates from history page.

    const session: Session = {
      sessionId,
      title: newTitle,
      workspaceDirectory: window.workspacePaths?.[0] || "",
      history,
    };

    await ideMessenger.request("history/save", session);

    if (openNewSession) {
      dispatch(newSession());
      updateLastSessionId(sessionId);
    } else {
      dispatch(updateSessionTitle(newTitle));
    }
  }

  async function getSession(id: string): Promise<Session> {
    const result = await ideMessenger.request("history/load", { id });
    if (result.status === "error") {
      throw new Error(result.error);
    }
    return result.content;
  }

  async function updateSession(session: Session) {
    return await ideMessenger.request("history/save", session);
  }

  async function deleteSession(id: string) {
    return await ideMessenger.request("history/delete", { id });
  }

  async function loadSession(id: string): Promise<Session> {
    updateLastSessionId(sessionId);
    const result = await ideMessenger.request("history/load", { id });
    if (result.status === "error") {
      throw new Error(result.error);
    }

    const sessionContent = result.content;
    dispatch(newSession(sessionContent));
    return sessionContent;
  }

  async function loadLastSession(): Promise<Session | undefined> {
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
    lastSessionId,
  };
}

export default useHistory;
