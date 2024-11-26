import { combineReducers, configureStore } from "@reduxjs/toolkit";
import miscReducer from "./slices/miscSlice";
import stateReducer from "./slices/stateSlice";
import uiStateReducer from "./slices/uiStateSlice";

import { persistReducer, persistStore } from "redux-persist";
import { createFilter } from "redux-persist-transform-filter";
import autoMergeLevel2 from "redux-persist/lib/stateReconciler/autoMergeLevel2";
import storage from "redux-persist/lib/storage";
import editModeStateReducer from "./slices/editModeState";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const rootReducer = combineReducers({
  state: stateReducer,
  misc: miscReducer,
  uiState: uiStateReducer,
  editModeState: editModeStateReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

const saveSubsetFilters = [
  createFilter("state", ["history", "sessionId", "defaultModelTitle"]),
];

const persistConfig = {
  key: "root",
  storage,
  transforms: [...saveSubsetFilters],
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
