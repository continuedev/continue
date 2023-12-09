import { ideRequest } from "core/ide/messaging";
import { PersistedSessionInfo, SessionInfo } from "core/types";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";

function useHistory() {
  const state = useSelector((state: RootStore) => state.state);

  async function getHistory(): Promise<SessionInfo[]> {
    return await ideRequest("history", {});
  }

  async function saveSession() {
    const sessionInfo: PersistedSessionInfo = {
      history: state.history,
      title: state.title,
      sessionId: state.sessionId,
      workspaceDirectory: (window as any).workspacePaths?.[0] || "",
    };
    return await ideRequest("saveSession", sessionInfo);
  }

  async function deleteSession(sessionId: string) {
    return await ideRequest("deleteSession", { sessionId });
  }

  async function loadSession(sessionId: string): Promise<PersistedSessionInfo> {
    return await ideRequest("loadSession", { sessionId });
  }

  return { getHistory, saveSession, deleteSession, loadSession };
}

export default useHistory;
