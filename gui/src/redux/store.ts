import { combineReducers, configureStore } from "@reduxjs/toolkit";
import miscReducer from "./slices/miscSlice";
import sessionReducer from "./slices/sessionSlice";
import uiReducer from "./slices/uiSlice";
import { persistReducer, persistStore } from "redux-persist";
import { createFilter } from "redux-persist-transform-filter";
import autoMergeLevel2 from "redux-persist/lib/stateReconciler/autoMergeLevel2";
import storage from "redux-persist/lib/storage";
import editModeStateReducer from "./slices/editModeState";
import configReducer from "./slices/configSlice";
import indexingReducer from "./slices/indexingSlice";

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

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

const saveSubsetFilters = [
  createFilter("state", ["messages", "sessionId", "defaultModelTitle"]),
];

const loadSubsetFilter = createFilter("state", null, [
  "session",
  "misc",
  "ui",
  "editModeState",
  "config",
  "indexing"
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
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
}

export const store = setupStore();

export const persistor = persistStore(store);
