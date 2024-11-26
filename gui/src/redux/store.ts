import { combineReducers, configureStore } from "@reduxjs/toolkit";
import configReducer from "./slices/configSlice";
import miscReducer from "./slices/miscSlice";
import serverStateReducer from "./slices/serverStateReducer";
import stateReducer from "./slices/stateSlice";
import uiStateReducer from "./slices/uiStateSlice";

import { useDispatch } from "react-redux";
import { createTransform, persistReducer, persistStore } from "redux-persist";
import { createFilter } from "redux-persist-transform-filter";
import autoMergeLevel2 from "redux-persist/lib/stateReconciler/autoMergeLevel2";
import storage from "redux-persist/lib/storage";
import { IdeMessenger, IIdeMessenger } from "../context/IdeMessenger";
import editModeStateReducer from "./slices/editModeState";
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const rootReducer = combineReducers({
  state: stateReducer,
  config: configReducer,
  misc: miscReducer,
  uiState: uiStateReducer,
  serverState: serverStateReducer,
  editModeState: editModeStateReducer,
});

const windowIDTransform = (windowID: string) =>
  createTransform(
    // transform state on its way to being serialized and persisted.
    (inboundState, key) => {
      return { [windowID]: inboundState };
    },
    // transform state being rehydrated
    (outboundState, key) => {
      return outboundState[windowID] || {};
    },
  );

const saveSubsetFilters = [
  createFilter("state", ["history", "sessionId", "defaultModelTitle"]),
  // Don't persist any of the edit state for now
  createFilter("editModeState", []),
];

const persistConfig = {
  key: "root",
  storage,
  transforms: [
    ...saveSubsetFilters,
    // windowIDTransform((window as any).windowId || "undefinedWindowId"),
  ],
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

export const useAppDispatch = () => useDispatch<AppDispatch>();

export const persistor = persistStore(store);
