import { useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import {
  deleteCompaction,
  setCompactionLoading,
} from "../redux/slices/sessionSlice";
import { calculateContextPercentage } from "../redux/thunks/calculateContextPercentage";
import { loadSession, saveCurrentSession } from "../redux/thunks/session";

export const useCompactConversation = () => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const currentSessionId = useAppSelector((state) => state.session.id);
  const history = useAppSelector((state) => state.session.history);

  return async (index: number) => {
    if (!currentSessionId) {
      return;
    }

    // Rough estimate: 0.5 seconds per message, minimum 5 seconds
    const estSeconds = Math.max(5, Math.ceil(history.length * 0.5));
    const timeText =
      estSeconds > 60
        ? `${Math.ceil(estSeconds / 60)} minutes`
        : `${estSeconds} seconds`;

    try {
      // Set loading state
      dispatch(setCompactionLoading({ index, loading: true }));
      ideMessenger.post("showToast", [
        "info",
        `Compacting conversation... (Estimated time: ${timeText})`,
        "Dismiss", // Adding a button should keep the notification persistent
      ]);

      // Save the session first to ensure the core has the latest history
      await dispatch(
        saveCurrentSession({
          openNewSession: false,
          generateTitle: false,
        }),
      );

      await ideMessenger.request("conversation/compact", {
        index,
        sessionId: currentSessionId,
      });

      // Reload the current session to refresh the conversation state
      const loadSessionResult = await dispatch(
        loadSession({
          sessionId: currentSessionId,
          saveCurrentSession: false,
        }),
      );

      // Calculate context percentage for the newly loaded session
      if (loadSessionResult.meta.requestStatus === "fulfilled") {
        await dispatch(calculateContextPercentage());
        ideMessenger.post("showToast", ["info", "Compaction complete"]);
      }
    } catch (error: any) {
      console.error("Error compacting conversation:", error);
      ideMessenger.post("showToast", [
        "error",
        `Compaction failed: ${error.message || error}`,
      ]);
    } finally {
      // Clear loading state
      dispatch(setCompactionLoading({ index, loading: false }));
    }
  };
};

export const useDeleteCompaction = () => {
  const dispatch = useAppDispatch();

  return async (index: number) => {
    // Update local state and save to persistence
    dispatch(deleteCompaction(index));
    await dispatch(
      saveCurrentSession({
        openNewSession: false,
        generateTitle: false,
      }),
    );
  };
};
