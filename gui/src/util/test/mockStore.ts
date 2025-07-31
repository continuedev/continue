import { configureStore } from "@reduxjs/toolkit";
import { vi } from "vitest";
import configReducer from "../../redux/slices/configSlice";
import editModeStateReducer from "../../redux/slices/editState";
import indexingReducer from "../../redux/slices/indexingSlice";
import { profilesReducer } from "../../redux/slices/profilesSlice";
import sessionReducer from "../../redux/slices/sessionSlice";
import tabsReducer from "../../redux/slices/tabsSlice";
import uiReducer from "../../redux/slices/uiSlice";
import { RootState } from "../../redux/store";

export const createMockStore = (initialState?: Partial<RootState>) => {
  const mockIdeMessenger = {
    request: vi.fn(),
    post: vi.fn(),
    llmStreamChat: vi.fn(),
  };

  const store = configureStore({
    reducer: {
      session: sessionReducer,
      ui: uiReducer,
      editModeState: editModeStateReducer,
      config: configReducer,
      indexing: indexingReducer,
      tabs: tabsReducer,
      profiles: profilesReducer,
    },
    preloadedState: {
      session: {
        history: [],
        title: "",
        id: "",
        lastSessionId: undefined,
        mode: "chat",
        isStreaming: false,
        streamAborter: new AbortController(),
        hasReasoningEnabled: false,
        contextPercentage: 0,
        isPruned: false,
        isInEdit: false,
        ...initialState?.session,
      },
      ui: {
        showDialog: false,
        dialogMessage: null,
        toolSettings: {},
        ruleSettings: {},
        ...initialState?.ui,
      },
      editModeState: {
        isInEdit: false,
        returnToMode: "chat",
        ...initialState?.editModeState,
      },
      config: {
        config: {
          models: [],
          tabAutocompleteModel: undefined,
          tools: [],
          rules: [],
          selectedModelByRole: {
            chat: null,
            apply: null,
            edit: null,
            summarize: null,
            autocomplete: null,
            rerank: null,
            embed: null,
          },
          ...initialState?.config?.config,
        },
        lastSelectedModelByRole: {},
        loading: false,
        configError: undefined,
        ...initialState?.config,
      },
      indexing: {
        indexingState: "disabled",
        ...initialState?.indexing,
      },
      tabs: {
        tabsItems: [],
        ...initialState?.tabs,
      },
      profiles: {
        profiles: [],
        ...initialState?.profiles,
      },
    } as RootState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredPaths: ["session.streamAborter"],
          ignoredActions: [
            "chat/streamNormalInput/pending",
            "chat/streamNormalInput/fulfilled",
            "chat/streamNormalInput/rejected",
          ],
        },
        thunk: {
          extraArgument: {
            ideMessenger: mockIdeMessenger,
          },
        },
      }),
  });

  // Add getActions method for testing
  const actions: any[] = [];
  const originalDispatch = store.dispatch;

  // Override dispatch to track actions and inject ideMessenger
  store.dispatch = vi.fn((action: any) => {
    if (typeof action === "function") {
      // For thunks, provide the extra argument with ideMessenger
      return action(store.dispatch, store.getState, {
        ideMessenger: mockIdeMessenger,
      });
    }
    actions.push(action);
    return originalDispatch(action);
  }) as any;

  (store as any).getActions = () => actions;
  (store as any).clearActions = () => actions.splice(0, actions.length);

  // Expose mockIdeMessenger so tests can configure it
  return { ...store, mockIdeMessenger };
};
