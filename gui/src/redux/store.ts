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
import { persistReducer, persistStore, createTransform } from "redux-persist";

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

const windowIDTransform = (windowID) =>
  createTransform(
    // transform state on its way to being serialized and persisted.
    (inboundState, key) => {
      return { [windowID]: inboundState };
    },
    // transform state being rehydrated
    (outboundState, key) => {
      return outboundState[windowID] || {};
    }
  );

const persistConfig = {
  key: "root",
  storage,
  transforms: [
    windowIDTransform((window as any).windowId || "undefinedWindowId"),
  ],
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
