import { configureStore } from "@reduxjs/toolkit";
import configReducer from "./slices/configSlice";
import miscReducer from "./slices/miscSlice";
import uiStateReducer from "./slices/uiStateSlice";
import { RangeInFile } from "../schema/RangeInFile";
import serverStateReducer from "./slices/serverStateReducer";
import sessionStateReducer, {
  SessionFullState,
} from "./slices/sessionStateReducer";
import {
  ContextProvider,
  ContinueConfig,
  SlashCommand,
} from "../schema/ContinueConfig";
import { ContextItem } from "../schema/ContextItem";

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
  misc: {
    highlightedCode: RangeInFile | undefined;
    takenAction: boolean;
    serverStatusMessage: string;
  };
  uiState: {
    bottomMessage: JSX.Element | undefined;
    bottomMessageCloseTimeout: NodeJS.Timeout | undefined;
    displayBottomMessageOnBottom: boolean;
    showDialog: boolean;
    dialogMessage: string | JSX.Element;
    dialogEntryOn: boolean;
  };
  sessionState: SessionFullState;
  serverState: {
    meilisearchUrl: string | undefined;
    userInputQueue: string[];
    slashCommands: SlashCommand[];
    selectedContextItems: ContextItem[];
    config: ContinueConfig;
    contextProviders: ContextProvider[];
    savedContextGroups: any[]; // TODO: Context groups
  };
}

const store = configureStore({
  reducer: {
    config: configReducer,
    misc: miscReducer,
    uiState: uiStateReducer,
    sessionState: sessionStateReducer,
    serverState: serverStateReducer,
  },
});

export default store;
