import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "./slices/chatSlice";
import configReducer from "./slices/configSlice";
import miscReducer from "./slices/miscSlice";
import uiStateReducer from "./slices/uiStateSlice";
import { FullState } from "../../../schema/FullState";
import { RangeInFile } from "../../../schema/RangeInFile";
import serverStateReducer from "./slices/serverStateReducer";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface RootStore {
  config: {
    workspacePaths: string[] | undefined;
    apiUrl: string;
    vscMachineId: string | undefined;
    sessionId: string | undefined;
    sessionStarted: number | undefined;
    vscMediaUrl: string | undefined;
    dataSwitchOn: boolean | undefined;
  };
  chat: {
    messages: ChatMessage[];
    isStreaming: boolean;
  };
  misc: {
    highlightedCode: RangeInFile | undefined;
    takenAction: boolean;
  };
  uiState: {
    bottomMessage: JSX.Element | undefined;
    bottomMessageCloseTimeout: NodeJS.Timeout | undefined;
    displayBottomMessageOnBottom: boolean;
    showDialog: boolean;
    dialogMessage: string | JSX.Element;
    dialogEntryOn: boolean;
  };
  serverState: FullState;
}

const store = configureStore({
  reducer: {
    chat: chatReducer,
    config: configReducer,
    misc: miscReducer,
    uiState: uiStateReducer,
    serverState: serverStateReducer,
  },
});

export default store;
