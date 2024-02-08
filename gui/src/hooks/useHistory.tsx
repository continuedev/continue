import { Dispatch } from "@reduxjs/toolkit";
import { PersistedSessionInfo, SessionInfo } from "core";
import { ideRequest, llmStreamChat } from "core/ide/messaging";
import { llmCanGenerateInParallel } from "core/llm/autodetect";
import { stripImages } from "core/llm/countTokens";
import { useSelector } from "react-redux";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import { newSession } from "../redux/slices/stateSlice";
import { RootStore } from "../redux/store";

function truncateText(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.slice(0, maxLength - 3) + "...";
  }
  return text;
}

function useHistory(dispatch: Dispatch) {
  const state = useSelector((state: RootStore) => state.state);
  const defaultModel = useSelector(defaultModelSelector);
  const disableSessionTitles = useSelector(
    (store: RootStore) => store.state.config.disableSessionTitles
  );

  async function getHistory(): Promise<SessionInfo[]> {
    return await ideRequest("history", {});
  }

  async function saveSession() {
    if (state.history.length === 0) return;

    const stateCopy = { ...state };
    dispatch(newSession());
    await new Promise((resolve) => setTimeout(resolve, 10));

    let title = truncateText(
      stripImages(stateCopy.history[0].message.content)
        .split("\n")
        .filter((l) => l.trim() !== "")
        .slice(-1)[0] || "",
      50
    );

    if (
      false && // Causing maxTokens to be set to 20 for main requests sometimes, so disabling until resolved
      !disableSessionTitles &&
      llmCanGenerateInParallel(defaultModel.provider, defaultModel.model)
    ) {
      let fullContent = "";
      for await (const { content } of llmStreamChat(
        defaultModel.title,
        undefined,
        [
          ...stateCopy.history.map((item) => item.message),
          {
            role: "user",
            content:
              "Give a maximum 40 character title to describe this conversation so far. The title should help me recall the conversation if I look for it later. DO NOT PUT QUOTES AROUND THE TITLE",
          },
        ],
        { maxTokens: 20 }
      )) {
        fullContent += content;
      }

      title = stripImages(fullContent);
    }

    const sessionInfo: PersistedSessionInfo = {
      history: stateCopy.history,
      title: title,
      sessionId: stateCopy.sessionId,
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
