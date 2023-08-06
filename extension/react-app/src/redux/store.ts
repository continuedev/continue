import { configureStore } from "@reduxjs/toolkit";
import debugStateReducer from "./slices/debugContexSlice";
import chatReducer from "./slices/chatSlice";
import configReducer from "./slices/configSlice";
import miscReducer from "./slices/miscSlice";
import uiStateReducer from "./slices/uiStateSlice";
import { RangeInFile, SerializedDebugContext } from "../../../src/client";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface RootStore {
  debugState: {
    debugContext: SerializedDebugContext;
    rangesMask: boolean[];
  };
  config: {
    workspacePath: string | undefined;
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
  };
  uiState: {
    bottomMessage: JSX.Element | undefined;
    bottomMessageCloseTimeout: NodeJS.Timeout | undefined;
    displayBottomMessageOnBottom: boolean;
    showDialog: boolean;
    dialogMessage: string | JSX.Element;
    dialogEntryOn: boolean;
  };
}

const store = configureStore({
  reducer: {
    debugState: debugStateReducer,
    chat: chatReducer,
    config: configReducer,
    misc: miscReducer,
    uiState: uiStateReducer,
  },
});

export default store;
