import { useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setCompactionLoading } from "../redux/slices/sessionSlice";
import { loadSession } from "../redux/thunks/session";

export const useCompactConversation = () => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const currentSessionId = useAppSelector((state) => state.session.id);

  return async (index: number) => {
    if (!currentSessionId) {
      return;
    }

    try {
      // Set loading state
      dispatch(setCompactionLoading({ index, loading: true }));

      await ideMessenger.request("conversation/compact", {
        index,
        sessionId: currentSessionId,
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