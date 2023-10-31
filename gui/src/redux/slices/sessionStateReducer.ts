import { createSlice } from "@reduxjs/toolkit";
import { StepDescription } from "../../schema/SessionState";
import { SessionUpdate } from "../../schema/SessionUpdate";
import { ContextItem } from "../../schema/ContextItem";
import { PersistedSessionInfo } from "../../schema/PersistedSessionInfo";
import { v4 } from "uuid";
import { ContextItemId } from "../../schema/ContextItemId";

export interface SessionFullState {
  history: StepDescription[];
  contextItemsAtIndex: { [index: number]: ContextItem[] };
  context_items: ContextItem[];
  active: boolean;
  title: string;
  session_id: string;
}

export const sessionStateSlice = createSlice({
  name: "sessionState",
  initialState: {
    history: [],
    context_items: [],
    active: false,
    title: "New Session",
    contextItemsAtIndex: {},
    session_id: v4(),
  },
  reducers: {
    processSessionUpdate: (
      state: SessionFullState,
      { payload }: { payload: SessionUpdate }
    ) => {
      let active = state.active;
      if (typeof payload.stop === "boolean") {
        active = !payload.stop;
      }

      let step: StepDescription | undefined = undefined;

      if (payload.index > state.history.length) {
        // Partial above to allow here
        step = {
          ...(payload.update as StepDescription),
        };
      } else if (payload.delta === true) {
        step = {
          ...state.history[payload.index],
        };
        if (payload.update.name) {
          step.name = (step.name ?? "") + payload.update.name;
        }
        if (payload.update.description) {
          step.description =
            (step.description ?? "") + payload.update.description;
        }
        if (payload.update.observations) {
          step.observations = [
            ...(step.observations ?? []),
            ...(payload.update.observations as any),
          ];
        }
        if (payload.update.logs) {
          step.logs = [...(step.logs ?? []), ...(payload.update.logs as any)];
        }
      } else if (payload.delta === false) {
        step = {
          ...state.history[payload.index],
          ...payload.update,
        };
      }

      let history = [...state.history];
      if (step) {
        history[payload.index] = step;
      }

      return {
        ...state,
        history,
        active,
      };
    },
    newSession: (
      state: SessionFullState,
      { payload }: { payload: PersistedSessionInfo | undefined }
    ) => {
      if (payload) {
        console.log("NEW SESSION");
        return {
          ...state,
          history: payload.session_state.history,
          context_items: payload.session_state.context_items,
          contextItemsAtIndex: {},
          active: false,
          title: payload.title,
          session_id: payload.session_id,
        };
      }
      return {
        ...state,
        history: [],
        context_items: [],
        contextItemsAtIndex: {},
        active: false,
        title: "New Session",
        session_id: v4(),
      };
    },
    setTitle: (state: SessionFullState, { payload }: { payload: string }) => {
      return {
        ...state,
        title: payload,
      };
    },
    setActive: (state: SessionFullState, { payload }: { payload: boolean }) => {
      return {
        ...state,
        active: payload,
      };
    },
    setHistory: (
      state: SessionFullState,
      { payload }: { payload: StepDescription[] }
    ) => {
      return {
        ...state,
        history: payload,
      };
    },
    deleteAtIndex: (
      state: SessionFullState,
      { payload }: { payload: number }
    ) => {
      let newHistory = [...state.history];
      newHistory[payload] = {
        ...newHistory[payload],
        hide: true,
      };
      return { ...state, history: newHistory };
    },
    addContextItem: (
      state: SessionFullState,
      { payload }: { payload: ContextItem }
    ) => {
      console.log("HERE...", payload);
      return {
        ...state,
        context_items: [...state.context_items, payload],
      };
    },
    addContextItemAtIndex: (
      state: SessionFullState,
      { payload }: { payload: { item: ContextItem; index: number } }
    ) => {
      return {
        ...state,
        contextItemsAtIndex: {
          ...state.contextItemsAtIndex,
          [payload.index]: [
            ...(state.contextItemsAtIndex[payload.index] ?? []),
            payload.item,
          ],
        },
      };
    },
    addHighlightedCode: (
      state: SessionFullState,
      {
        payload,
      }: {
        payload: { rangeInFileWithContents: any; edit: boolean };
      }
    ) => {
      // TODO: Merging
      let contextItems = [...state.context_items].map((item) => {
        return { ...item, editing: false };
      });
      const lineNums = `(${
        payload.rangeInFileWithContents.range.start.line + 1
      }-${payload.rangeInFileWithContents.range.end.line + 1})`;
      const base = payload.rangeInFileWithContents.filepath
        .split(/[\\/]/)
        .pop();
      contextItems.push({
        description: {
          name: `${base} ${lineNums}`,
          description: payload.rangeInFileWithContents.filepath,
          id: {
            provider_title: "code",
            item_id: v4(),
          },
        },
        content: payload.rangeInFileWithContents.contents,
        editing: true,
        editable: true,
      });

      return { ...state, context_items: contextItems };
    },
    deleteContextWithIds: (
      state: SessionFullState,
      {
        payload,
      }: { payload: { ids: ContextItemId[]; index: number | undefined } }
    ) => {
      const ids = payload.ids.map((id) => `${id.provider_title}-${id.item_id}`);
      if (typeof payload.index === "undefined") {
        return {
          ...state,
          context_items: state.context_items.filter(
            (item) =>
              !ids.includes(
                `${item.description.id.provider_title}-${item.description.id.item_id}`
              )
          ),
        };
      } else {
        return {
          ...state,
          contextItemsAtIndex: {
            ...state.contextItemsAtIndex,
            [payload.index]: (
              state.contextItemsAtIndex[payload.index] ?? []
            ).filter(
              (item) =>
                !ids.includes(
                  `${item.description.id.provider_title}-${item.description.id.item_id}`
                )
            ),
          },
        };
      }
    },
    setEditingAtIds: (
      state: SessionFullState,
      {
        payload,
      }: { payload: { ids: ContextItemId[]; index: number | undefined } }
    ) => {
      const ids = payload.ids.map((id) => id.item_id);

      if (typeof payload.index === "undefined") {
        return {
          ...state,
          context_items: state.context_items.map((item) => {
            return {
              ...item,
              editing: ids.includes(item.description.id.item_id),
            };
          }),
        };
      } else {
        return {
          ...state,
          contextItemsAtIndex: {
            ...state.contextItemsAtIndex,
            [payload.index]: (
              state.contextItemsAtIndex[payload.index] ?? []
            ).map((item) => {
              return {
                ...item,
                editing: ids.includes(item.description.id.item_id),
              };
            }),
          },
        };
      }
    },
  },
});

export const {
  setActive,
  setHistory,
  processSessionUpdate,
  newSession,
  deleteAtIndex,
  addContextItem,
  addContextItemAtIndex,
  addHighlightedCode,
  deleteContextWithIds,
  setTitle,
  setEditingAtIds,
} = sessionStateSlice.actions;
export default sessionStateSlice.reducer;
