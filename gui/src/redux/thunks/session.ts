import { createAsyncThunk, Dispatch, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage, Session, SessionMetadata } from "core";
import { NEW_SESSION_TITLE } from "core/util/constants";
import { renderChatMessage } from "core/util/messageContent";
import { ThunkApiType } from "../store";
import {
  deleteSessionMetadata,
  newSession,
  setAllSessionMetadata,
  updateSessionMetadata,
} from "../slices/sessionSlice";
import { IIdeMessenger } from "../../context/IdeMessenger";

const MAX_TITLE_LENGTH = 100;

// Async session functions live in thunks (because of IDE messaging mostly)
// see sessionSlice for sync redux session functions

export async function getSession(
  ideMessenger: IIdeMessenger,
  id: string,
): Promise<Session> {
  const result = await ideMessenger.request("history/load", { id });
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return result.content;
}

export const refreshSessionMetadata = createAsyncThunk<
  SessionMetadata[],
  {
    offset?: number;
    limit?: number;
  },
  ThunkApiType
>("session/refreshMetadata", async ({ offset, limit }, { dispatch, extra }) => {
  const result = await extra.ideMessenger.request("history/list", {
    limit,
    offset,
  });
  if (result.status === "error") {
    throw new Error(result.error);
  }
  dispatch(setAllSessionMetadata(result.content));
  return result.content;
});

export const deleteSession = createAsyncThunk<void, string, ThunkApiType>(
  "session/delete",
  async (id, { getState, dispatch, extra }) => {
    dispatch(deleteSessionMetadata(id)); // optimistic
    const state = getState();
    if (id === state.session.id) {
      await dispatch(
        loadLastSession({
          saveCurrentSession: false,
        }),
      );
    }
    const result = await extra.ideMessenger.request("history/delete", { id });
    if (result.status === "error") {
      throw new Error(result.error);
    }
    dispatch(refreshSessionMetadata({}));
  },
);

export const updateSession = createAsyncThunk<void, Session, ThunkApiType>(
  "session/update",
  async (session, { extra, dispatch }) => {
    dispatch(
      updateSessionMetadata({
        sessionId: session.sessionId,
        title: session.title,
      }),
    ); // optimistic session metadata update
    await extra.ideMessenger.request("history/save", session);
    await dispatch(refreshSessionMetadata({}));
  },
);

/*
 this is only used for the custom focusContinueSessionId command at the moment
*/
export const loadSession = createAsyncThunk<
  void,
  {
    sessionId: string;
    saveCurrentSession: boolean;
  },
  ThunkApiType
>(
  "session/load",
  async ({ sessionId, saveCurrentSession: save }, { extra, dispatch }) => {
    if (save) {
      const result = await dispatch(
        saveCurrentSession({
          openNewSession: false,
        }),
      );
      unwrapResult(result);
    }
    const session = await getSession(extra.ideMessenger, sessionId);
    dispatch(newSession(session));
  },
);

export const loadLastSession = createAsyncThunk<
  void,
  {
    saveCurrentSession: boolean;
  },
  ThunkApiType
>(
  "session/loadLast",
  async ({ saveCurrentSession }, { extra, dispatch, getState }) => {
    const state = getState();

    if (state.session.id && saveCurrentSession) {
    }
    const lastSessionId = getState().session.lastSessionId;

    if (!lastSessionId) {
      dispatch(newSession());
      return;
    }

    const session = await getSession(extra.ideMessenger, lastSessionId);
    dispatch(newSession(session));
  },
);

function getChatTitleFromMessage(message: ChatMessage) {
  const text =
    renderChatMessage(message)
      .split("\n")
      .filter((l) => l.trim() !== "")
      .slice(-1)[0] || "";

  // Truncate
  if (text.length > MAX_TITLE_LENGTH) {
    return text.slice(0, MAX_TITLE_LENGTH - 3) + "...";
  }
  return text;
}

export const saveCurrentSession = createAsyncThunk<
  void,
  { openNewSession: boolean },
  ThunkApiType
>(
  "session/saveCurrent",
  async ({ openNewSession }, { dispatch, extra, getState }) => {
    const state = getState();
    if (state.session.history.length === 0) {
      return;
    }

    if (openNewSession) {
      dispatch(newSession());
    }

    // New session has already been dispatched
    // Now save previous session and update chat title if relevant
    let title = state.session.title;
    if (title === NEW_SESSION_TITLE) {
      if (
        state.config.config?.ui?.getChatTitles &&
        state.config.defaultModelTitle
      ) {
        let assistantResponse = state.session.history
          ?.filter((h) => h.message.role === "assistant")[0]
          ?.message?.content?.toString();

        if (assistantResponse) {
          try {
            const result = await extra.ideMessenger.request(
              "chatDescriber/describe",
              {
                text: assistantResponse,
                selectedModelTitle: state.config.defaultModelTitle,
              },
            );
            if (result.status === "success" && result.content) {
              title = result.content;
            }
          } catch (e) {
            console.error("Error generating chat title", e);
          }
        }
      }
      // Fallbacks if above doesn't work out or getChatTitles = false
      if (title === NEW_SESSION_TITLE) {
        title = getChatTitleFromMessage(history[0].message);
      }
    }
    // More fallbacks in case of no title
    if (!title.length) {
      const metadata = getState().session.allSessionMetadata.find(
        (m) => m.sessionId === state.session.id,
      );
      if (metadata?.title) {
        title = metadata.title;
      }
    }
    if (!title.length) {
      title = NEW_SESSION_TITLE;
    }

    const session: Session = {
      sessionId: state.session.id,
      title,
      workspaceDirectory: window.workspacePaths?.[0] || "",
      history: state.session.history,
    };

    const result = await dispatch(updateSession(session));
    unwrapResult(result);
  },
);
