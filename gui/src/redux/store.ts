import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { createLogger } from "redux-logger";
import {
  createMigrate,
  MigrationManifest,
  persistReducer,
  persistStore,
} from "redux-persist";
import { createFilter } from "redux-persist-transform-filter";
import autoMergeLevel2 from "redux-persist/lib/stateReconciler/autoMergeLevel2";
import storage from "redux-persist/lib/storage";
import { IdeMessenger, IIdeMessenger } from "../context/IdeMessenger";
import { profilesReducer } from "./slices";
import configReducer from "./slices/configSlice";
import editModeStateReducer from "./slices/editModeState";
import indexingReducer from "./slices/indexingSlice";
import sessionReducer from "./slices/sessionSlice";
import tabsReducer from "./slices/tabsSlice";
import uiReducer from "./slices/uiSlice";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const rootReducer = combineReducers({
  session: sessionReducer,
  ui: uiReducer,
  editModeState: editModeStateReducer,
  config: configReducer,
  indexing: indexingReducer,
  tabs: tabsReducer,
  profiles: profilesReducer,
});

const saveSubsetFilters = [
  createFilter("session", [
    "history",
    "id",
    "lastSessionId",
    "title",

    // Persist edit mode in case closes in middle
    "mode",
    "codeToEdit",

    // higher risk to persist
    // codeBlockApplyStates
    // symbols
    // curCheckpointIndex
  ]),
  // Don't persist any of the edit state for now
  createFilter("editModeState", []),
  createFilter("config", ["defaultModelTitle"]),
  createFilter("ui", ["toolSettings", "toolGroupSettings"]),
  createFilter("indexing", []),
  createFilter("tabs", ["tabs"]),
  createFilter("profiles", [
    "preferencesByProfileId",
    "selectedProfileId",
    "selectedOrganizationId",
    "organizations",
  ]),
];

const migrations: MigrationManifest = {
  "0": (state) => {
    const oldState = state as any;

    return {
      config: {
        defaultModelTitle: oldState?.state?.defaultModelTitle ?? undefined,
      },
      session: {
        history: oldState?.state?.history ?? [],
        id: oldState?.state?.sessionId ?? "",
      },
      tabs: {
        tabs: [
          {
            id:
              Date.now().toString(36) + Math.random().toString(36).substring(2),
            title: "Chat 1",
            isActive: true,
          },
        ],
      },
      _persist: oldState?._persist,
    };
  },
};

const persistConfig = {
  version: 1,
  key: "root",
  storage,
  transforms: [...saveSubsetFilters],
  stateReconciler: autoMergeLevel2,
  migrate: createMigrate(migrations, { debug: false }),
};

const persistedReducer = persistReducer<ReturnType<typeof rootReducer>>(
  persistConfig,
  rootReducer,
);

export function setupStore() {
  const logger = createLogger({
    // Customize logger options if needed
    collapsed: true, // Collapse console groups by default
    timestamp: false, // Remove timestamps from log
    diff: true, // Show diff between states
  });

  return configureStore({
    // persistedReducer causes type errors with async thunks
    reducer: persistedReducer as unknown as typeof rootReducer,
    // reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        thunk: {
          extraArgument: {
            ideMessenger: new IdeMessenger(),
          },
        },
      }),
    // This can be uncommented to get detailed Redux logs
    // .concat(logger),
  });
}

export type ThunkApiType = {
  state: RootState;
  extra: { ideMessenger: IIdeMessenger };
};

export const store = setupStore();

export type RootState = ReturnType<typeof rootReducer>;

export type AppDispatch = typeof store.dispatch;

export const persistor = persistStore(store);
