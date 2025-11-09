import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { BaseSessionMetadata, ChatMessage, Session } from "core";
import { RemoteSessionMetadata } from "core/control-plane/client";
import { NEW_SESSION_TITLE } from "core/util/constants";
import { renderChatMessage } from "core/util/messageContent";
import { v4 as uuidv4 } from "uuid";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  deleteSessionMetadata,
  newSession,
  setAllSessionMetadata,
  setIsSessionMetadataLoading,
  updateSessionMetadata,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";

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

export async function getRemoteSession(
  ideMessenger: IIdeMessenger,
  remoteId: string,
): Promise<Session> {
  const result = await ideMessenger.request("history/loadRemote", { remoteId });
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return result.content;
}

export const refreshSessionMetadata = createAsyncThunk<
  RemoteSessionMetadata[] | BaseSessionMetadata[],
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
  dispatch(setIsSessionMetadataLoading(false));
  dispatch(setAllSessionMetadata(result.content));
  return result.content;
});

export const deleteSession = createAsyncThunk<void, string, ThunkApiType>(
  "session/delete",
  async (id, { getState, dispatch, extra }) => {
    dispatch(deleteSessionMetadata(id)); // optimistic
    const state = getState();
    if (id === state.session.id) {
      await dispatch(loadLastSession());
    }
    const result = await extra.ideMessenger.request("history/delete", { id });
    if (result.status === "error") {
      throw new Error(result.error);
    }
    void dispatch(refreshSessionMetadata({}));
  },
);

export const copySession = createAsyncThunk<
  string, // Return the new session ID
  {
    sessionId: string;
    upToMessageIndex?: number;
    titlePrefix?: string;
  },
  ThunkApiType
>(
  "session/copy",
  async (
    { sessionId, upToMessageIndex, titlePrefix = "Copy" },
    { dispatch, extra, getState },
  ) => {
    try {
      // Load the source session
      const sourceSession = await getSession(extra.ideMessenger, sessionId);

      // Validate session has history to copy
      if (!sourceSession.history || sourceSession.history.length === 0) {
        throw new Error("Cannot copy session with no history");
      }

      // Create a deep copy of the session history
      let copiedHistory = sourceSession.history.map((item) => ({
        ...item,
        message: {
          ...item.message,
          id: uuidv4(), // Generate new message IDs
        },
        // Deep copy context items if they exist
        contextItems: item.contextItems ? [...item.contextItems] : [],
        // Deep copy other properties that might contain references
        ...(item.toolCallStates && {
          toolCallStates: item.toolCallStates.map((state) => ({
            ...state,
            toolCallId: uuidv4(), // Generate new tool call IDs
          })),
        }),
      }));

      // If upToMessageIndex is specified, slice the history (for future feature)
      if (upToMessageIndex !== undefined) {
        if (upToMessageIndex < 0 || upToMessageIndex >= copiedHistory.length) {
          throw new Error("Invalid message index for copying");
        }
        copiedHistory = copiedHistory.slice(0, upToMessageIndex + 1);
      }

      // Generate numbered title with prefix, scoped to this base title chain
      const state = getState();
      const existingSessions = state.session.allSessionMetadata;
      const existingTitles = existingSessions.map((s) => s.title);

      // Extract base title by removing any existing numbered prefix
      const baseTitle = sourceSession.title.replace(/^.*?\d+ of /, "");

      // Find first unused numbered title
      let newTitle: string;
      for (let i = 1; ; i++) {
        let title = `${titlePrefix}${i} of ${baseTitle}`;

        // Truncate if too long
        if (title.length > MAX_TITLE_LENGTH) {
          const prefix = `${titlePrefix}${i} of `;
          const maxBase = MAX_TITLE_LENGTH - prefix.length;
          const truncated =
            maxBase > 3
              ? baseTitle.slice(0, maxBase - 3) + "..."
              : baseTitle.slice(0, Math.max(0, maxBase));
          title = prefix + truncated;
        }

        // Use first unused title
        if (!existingTitles.includes(title)) {
          newTitle = title;
          break;
        }
      }

      // Create new session with copied data
      const newSessionId = uuidv4();
      const newSession: Session = {
        sessionId: newSessionId,
        title: newTitle,
        workspaceDirectory: sourceSession.workspaceDirectory,
        history: copiedHistory,
      };

      // Save the new session
      const result = await dispatch(updateSession(newSession));
      unwrapResult(result);

      // Refresh session metadata to show the new session in the list
      void dispatch(refreshSessionMetadata({}));

      return newSessionId;
    } catch (error) {
      console.error("Failed to copy session:", error);
      throw error; // Re-throw to let the UI handle the error
    }
  },
);

export const forkSession = createAsyncThunk<
  void,
  {
    sessionId: string;
    upToMessageIndex: number;
  },
  ThunkApiType
>(
  "session/fork",
  async ({ sessionId, upToMessageIndex }, { dispatch, getState, extra }) => {
    try {
      // Import tab actions here to avoid auto-formatting issues
      const { addTab, setActiveTab } = await import("../slices/tabsSlice");

      // Save current session if it has history
      const state = getState();
      if (state.session.history.length > 0) {
        await dispatch(
          saveCurrentSession({
            openNewSession: false,
            generateTitle: true,
          }),
        );
      }

      // Create the forked session using copySession with "Fork" prefix
      const result = await dispatch(
        copySession({
          sessionId,
          upToMessageIndex,
          titlePrefix: "Fork",
        }),
      );
      const newSessionId = unwrapResult(result);

      // Load the new session
      const session = await getSession(extra.ideMessenger, newSessionId);
      dispatch(newSession(session));

      // Create a new tab for the forked session
      const newTabId =
        Date.now().toString(36) + Math.random().toString(36).substring(2);
      dispatch(
        addTab({
          id: newTabId,
          title: session.title,
          isActive: true,
          sessionId: newSessionId,
        }),
      );
      dispatch(setActiveTab(newTabId));
    } catch (error) {
      console.error("Failed to fork session:", error);
      throw error;
    }
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
          generateTitle: true,
        }),
      );
      unwrapResult(result);
    }
    const session = await getSession(extra.ideMessenger, sessionId);
    dispatch(newSession(session));
  },
);

export const loadRemoteSession = createAsyncThunk<
  void,
  {
    remoteId: string;
    saveCurrentSession: boolean;
  },
  ThunkApiType
>(
  "session/loadRemote",
  async ({ remoteId, saveCurrentSession: save }, { extra, dispatch }) => {
    if (save) {
      const result = await dispatch(
        saveCurrentSession({
          openNewSession: false,
          generateTitle: true,
        }),
      );
      unwrapResult(result);
    }
    const session = await getRemoteSession(extra.ideMessenger, remoteId);
    dispatch(newSession(session));
  },
);

export const loadLastSession = createAsyncThunk<void, void, ThunkApiType>(
  "session/loadLast",
  async (_, { extra, dispatch, getState }) => {
    let lastSessionId = getState().session.lastSessionId;

    // const lastSessionResult = await extra.ideMessenger.request("history/list", {
    //   limit: 1,
    // });
    // if (lastSessionResult.status === "success") {
    //   lastSessionId = lastSessionResult.content.at(0)?.sessionId;
    // }

    if (!lastSessionId) {
      dispatch(newSession());
      return;
    }

    let session: Session;
    try {
      session = await getSession(extra.ideMessenger, lastSessionId);
    } catch {
      // retry again after 1 sec
      await new Promise((resolve) => setTimeout(resolve, 1000));
      session = await getSession(extra.ideMessenger, lastSessionId);
    }
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
  { openNewSession: boolean; generateTitle: boolean },
  ThunkApiType
>(
  "session/saveCurrent",
  async ({ openNewSession, generateTitle }, { dispatch, extra, getState }) => {
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
      const selectedChatModel = selectSelectedChatModel(state);

      if (!state.config.config?.disableSessionTitles && selectedChatModel) {
        let assistantResponse = state.session.history
          ?.filter((h) => h.message.role === "assistant")[0]
          ?.message?.content?.toString();

        if (assistantResponse && generateTitle) {
          try {
            const result = await extra.ideMessenger.request(
              "chatDescriber/describe",
              {
                text: assistantResponse,
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
      // Fallbacks if above doesn't work out or session titles disabled
      if (title === NEW_SESSION_TITLE) {
        title = getChatTitleFromMessage(state.session.history[0].message);
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
