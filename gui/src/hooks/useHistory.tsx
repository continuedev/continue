import { ideRequest } from "core/ide/messaging";
import { PersistedSessionInfo, SessionInfo } from "core/types";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";

function truncateText(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.slice(0, maxLength - 3) + "...";
  }
  return text;
}

function useHistory() {
  const state = useSelector((state: RootStore) => state.state);

  async function getHistory(): Promise<SessionInfo[]> {
    return await ideRequest("history", {});
  }

  async function saveSession() {
    if (state.history.length === 0) return;
    const sessionInfo: PersistedSessionInfo = {
      history: state.history,
      title:
        state.title === "New Session"
          ? truncateText(state.history[0].message.content, 50)
          : state.title,
      sessionId: state.sessionId,
      workspaceDirectory: (window as any).workspacePaths?.[0] || "",
    };
    return await ideRequest("saveSession", sessionInfo);
  }

  async function deleteSession(sessionId: string) {
    return await ideRequest("deleteSession", sessionId);
  }

  async function loadSession(sessionId: string): Promise<PersistedSessionInfo> {
    return await ideRequest("loadSession", sessionId);
  }

  return { getHistory, saveSession, deleteSession, loadSession };
}

export default useHistory;
