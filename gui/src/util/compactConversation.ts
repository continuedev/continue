import { useContext } from "react";
import { useStore } from "react-redux";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import {
  setCompactionLoading,
  deleteCompaction,
} from "../redux/slices/sessionSlice";
import { loadSession, saveCurrentSession } from "../redux/thunks/session";
import type { RootState } from "../redux/store";
import { compactionPrefix } from "./compactionPrefix";

export const useCompactConversation = () => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const currentSessionId = useAppSelector((state) => state.session.id);
  const store = useStore<RootState>();

  return async (index: number) => {
    if (!currentSessionId) {
      return;
    }

    try {
      // Set loading state
      dispatch(setCompactionLoading({ index, loading: true }));

      // While the prompt cache is warm, the summary request is the conversation
      // plus the summary prompt, so it reads the cache. Otherwise it is sent
      // as it always was.
      const prefix = compactionPrefix(store.getState(), index, Date.now());

      await ideMessenger.request("conversation/compact", {
        index,
        sessionId: currentSessionId,
        ...(prefix && { prefix }),
      });

      // Reload the current session to refresh the conversation state
      dispatch(
        loadSession({
          sessionId: currentSessionId,
          saveCurrentSession: false,
        }),
      );
    } catch (error) {
      console.error("Error compacting conversation:", error);
    } finally {
      // Clear loading state
      dispatch(setCompactionLoading({ index, loading: false }));
    }
  };
};

export const useDeleteCompaction = () => {
  const dispatch = useAppDispatch();

  return (index: number) => {
    // Update local state and save to persistence
    dispatch(deleteCompaction(index));
    dispatch(
      saveCurrentSession({
        openNewSession: false,
        generateTitle: false,
      }),
    );
  };
};
