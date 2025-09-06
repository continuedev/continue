import { PayloadAction, createSlice } from "@reduxjs/toolkit";

export interface Tab {
  id: string;
  title: string;
  isActive: boolean;
  sessionId?: string;
  modelTitle?: string; // store per-tab model
}

interface TabsState {
  tabs: Tab[];
}

const initialState: TabsState = {
  tabs: [
    {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      title: "Chat 1",
      isActive: true,
      modelTitle: undefined,
    },
  ],
};

export const tabsSlice = createSlice({
  name: "tabs",
  initialState,
  reducers: {
    setTabs: (state, action: PayloadAction<Tab[]>) => {
      state.tabs = action.payload;
    },
    updateTab: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Tab> }>,
    ) => {
      const { id, updates } = action.payload;
      state.tabs = state.tabs.map((tab) =>
        tab.id === id ? { ...tab, ...updates } : tab,
      );
    },
    // Set the model title for a specific tab
    setTabModel: (
      state,
      action: PayloadAction<{ id: string; modelTitle: string }>,
    ) => {
      const { id, modelTitle } = action.payload;
      state.tabs = state.tabs.map((tab) =>
        tab.id === id ? { ...tab, modelTitle } : tab,
      );
    },
    addTab: (state, action: PayloadAction<Tab>) => {
      state.tabs = state.tabs
        .map((tab) => ({
          ...tab,
          isActive: action.payload.isActive ? false : tab.isActive,
        }))
        .concat(action.payload);
    },
    removeTab: (state, action: PayloadAction<string>) => {
      state.tabs = state.tabs.filter((tab) => tab.id !== action.payload);
    },
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.tabs = state.tabs.map((tab) => ({
        ...tab,
        isActive: tab.id === action.payload,
      }));
    },
    handleSessionChange: (
      state,
      action: PayloadAction<{
        currentSessionId: string;
        currentSessionTitle: string;
        newTabId?: string;
      }>,
    ) => {
      const { currentSessionId, currentSessionTitle, newTabId } =
        action.payload;

      const activeTab = state.tabs.find((tab) => tab.isActive);
      if (!activeTab) return;

      // Current session matches active tab's session
      if (activeTab.sessionId === currentSessionId) {
        state.tabs = state.tabs.map((tab) =>
          tab.id === activeTab.id
            ? { ...tab, title: currentSessionTitle }
            : tab,
        );
        return;
      }

      // Check if there's another tab with the same session ID
      const existingTabWithSession = state.tabs.find(
        (tab) => tab.sessionId === currentSessionId,
      );
      if (existingTabWithSession) {
        // Activate the existing tab and update its title
        // Remove any unassigned tabs
        state.tabs = state.tabs
          .filter(
            (tab) => tab.sessionId || tab.id === existingTabWithSession.id,
          )
          .map((tab) => ({
            ...tab,
            isActive: tab.id === existingTabWithSession.id,
            title:
              tab.sessionId === currentSessionId
                ? currentSessionTitle
                : tab.title,
          }));
        return;
      }

      // Active tab has no session ID
      if (!activeTab.sessionId) {
        state.tabs = state.tabs.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                sessionId: currentSessionId,
                title: currentSessionTitle,
              }
            : tab,
        );
      } else {
        // Active tab has a session ID, create new tab
        state.tabs = state.tabs
          .map((tab) => ({ ...tab, isActive: false }))
          .concat({
            id:
              newTabId ||
              Date.now().toString(36) + Math.random().toString(36).substring(2),
            title: currentSessionTitle,
            isActive: true,
            sessionId: currentSessionId,
            modelTitle: undefined,
          });
      }
    },
  },
});

export const {
  setTabs,
  updateTab,
  setTabModel,
  addTab,
  removeTab,
  setActiveTab,
  handleSessionChange,
} = tabsSlice.actions;

export default tabsSlice.reducer;
