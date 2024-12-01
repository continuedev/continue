import { combineReducers, configureStore } from "@reduxjs/toolkit";
import miscReducer from "./slices/miscSlice";
import { persistReducer, persistStore } from "redux-persist";
import { createFilter } from "redux-persist-transform-filter";
import autoMergeLevel2 from "redux-persist/lib/stateReconciler/autoMergeLevel2";
import storage from "redux-persist/lib/storage";
import { IdeMessenger, IIdeMessenger } from "../context/IdeMessenger";
import editModeStateReducer from "./slices/editModeState";
import configReducer from "./slices/configSlice";
import indexingReducer from "./slices/indexingSlice";
import sessionReducer from "./slices/sessionSlice";
import uiReducer from "./slices/uiSlice";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const rootReducer = combineReducers({
  session: sessionReducer,
  misc: miscReducer,
  ui: uiReducer,
  editModeState: editModeStateReducer,
  config: configReducer,
  indexing: indexingReducer,
});

const saveSubsetFilters = [
  createFilter("session", ["history", "sessionId", "defaultModelTitle"]),
  // Don't persist any of the edit state for now
  createFilter("editModeState", []),
];

const loadSubsetFilter = createFilter("state", null, [
  "session",
  "misc",
  "ui",
  "editModeState",
  "config",
  "indexing",
]);

const persistConfig = {
  key: "root",
  storage,
  transforms: [...saveSubsetFilters, loadSubsetFilter],
  stateReconciler: autoMergeLevel2,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export function setupStore() {
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
