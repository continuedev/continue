import { combineReducers, configureStore } from "@reduxjs/toolkit";
import configReducer from "./slices/configSlice";
import miscReducer from "./slices/miscSlice";
import uiStateReducer from "./slices/uiStateSlice";
import serverStateReducer from "./slices/serverStateReducer";
import sessionStateReducer, {
  SessionFullState,
} from "./slices/sessionStateReducer";
import { ContinueConfig } from "../schema/ContinueConfig";
import { ContextItem } from "../schema/ContextItem";
import { ContextProviderDescription } from "../schema/ContextProviderDescription";
import { SlashCommandDescription } from "../schema/SlashCommandDescription";

import storage from "redux-persist/lib/storage";
import { persistReducer, persistStore } from "redux-persist";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface RootStore {
  config: {
    workspacePaths: string[] | undefined;
    apiUrl: string;
    vscMachineId: string | undefined;
    vscMediaUrl: string | undefined;
    windowId: string | undefined;
  };
  misc: {
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
    slashCommands: SlashCommandDescription[];
    selectedContextItems: ContextItem[];
    config: ContinueConfig;
    contextProviders: ContextProviderDescription[];
    savedContextGroups: any[]; // TODO: Context groups
  };
}

const rootReducer = combineReducers({
  config: configReducer,
  misc: miscReducer,
  uiState: uiStateReducer,
  sessionState: sessionStateReducer,
  serverState: serverStateReducer,
});

const persistConfig = {
  key: "root",
  storage,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);
