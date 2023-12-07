import { createSlice } from "@reduxjs/toolkit";
import { StepDescription } from "../../schema/SessionState";
import { SessionUpdate } from "../../schema/SessionUpdate";
import { ContextItem } from "../../../../core/llm/types";
import { PersistedSessionInfo } from "../../schema/PersistedSessionInfo";
import { v4 } from "uuid";
import { ContextItemId } from "../../../../core/llm/types";

const TEST_CONTEXT_ITEMS: ContextItem[] = [
  {
    content: "def add(a, b):\n  return a + b",
    description: "test.py",
    name: "test.py",

    id: {
      itemId: "test.py",
      providerTitle: "file",
    },
  },
  {
    content: "function add(a, b) {\n  return a + b\n}",

    description: "test.js",
    name: "test.js",
    id: {
      itemId: "test.js",
      providerTitle: "file",
    },
  },
];

const TEST_TIMELINE = [
  {
    description: "Hi, please write bubble sort in python",
    name: "User Input",
    params: { context_items: TEST_CONTEXT_ITEMS },
    hide: false,
    depth: 0,
  },
  {
    description: `\`\`\`python
def bubble_sort(arr):
  n = len(arr)
  for i in range(n):
      for j in range(0, n - i - 1):
          if arr[j] > arr[j + 1]:
              arr[j], arr[j + 1] = arr[j + 1], arr[j]
              return arr
\`\`\``,
    name: "Bubble Sort in Python",
    params: {},
    hide: false,
    depth: 0,
  },
  {
    description: "Now write it in Rust",
    name: "User Input",
    params: {},
  },
  {
    description: "Hello! This is a test...\n\n1, 2, 3, testing...",
    name: "Testing",
    hide: false,
  },
  {
    description: `Sure, here's bubble sort written in rust: \n\`\`\`rust
fn bubble_sort<T: Ord>(values: &mut[T]) {
  let len = values.len();
  for i in 0..len {
      for j in 0..(len - i - 1) {
          if values[j] > values[j + 1] {
              values.swap(j, j + 1);
          }
      }
  }
}
\`\`\`\nIs there anything else I can answer?`,
    name: "Rust Bubble Sort",
    depth: 0,
  },
];

export interface SessionFullState {
  history: StepDescription[];
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
      } else {
        active = true;
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
        if (payload.index >= history.length) {
          history.push(step);
        } else {
          history[payload.index] = step;
        }
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
      return {
        ...state,
        context_items: [...state.context_items, payload],
      };
    },
    addContextItemAtIndex: (
      state: SessionFullState,
      { payload }: { payload: { item: ContextItem; index: number } }
    ) => {
      let history = [...state.history];
      history[payload.index] = {
        ...history[payload.index],
        params: {
          ...history[payload.index].params,
          context_items: [
            ...((history[payload.index].params?.context_items as any) || []),
            payload.item,
          ],
        },
      };

      return {
        ...state,
        history,
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
      let contextItems = [...state.context_items].map((item) => {
        return { ...item, editing: false };
      });
      const base = payload.rangeInFileWithContents.filepath
        .split(/[\\/]/)
        .pop();

      // Merge if there is overlap
      for (let i = 0; i < contextItems.length; i++) {
        const item = contextItems[i];
        if (item.description === payload.rangeInFileWithContents.filepath) {
          let newStart = payload.rangeInFileWithContents.range.start.line;
          let newEnd = payload.rangeInFileWithContents.range.end.line;
          let [oldStart, oldEnd] = item.name
            .split("(")[1]
            .split(")")[0]
            .split("-")
            .map((x: string) => parseInt(x) - 1);
          if (newStart > oldEnd || newEnd < oldStart) {
            continue;
          }
          const startLine = Math.min(newStart, oldStart);
          const endLine = Math.max(newEnd, oldEnd);

          // const oldContents = item.content.split("\n");
          // const newContents =
          //   payload.rangeInFileWithContents.contents.split("\n");
          // const finalContents = [];

          contextItems[i] = {
            ...item,
            name: `${base} (${startLine + 1}-${endLine + 1})`,
            content: payload.rangeInFileWithContents.contents,
            editing: true,
            editable: true,
          };
          return { ...state, context_items: contextItems };
        }
      }

      const lineNums = `(${
        payload.rangeInFileWithContents.range.start.line + 1
      }-${payload.rangeInFileWithContents.range.end.line + 1})`;
      contextItems.push({
        name: `${base} ${lineNums}`,
        description: payload.rangeInFileWithContents.filepath,
        id: {
          providerTitle: "code",
          itemId: v4(),
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
      const ids = payload.ids.map((id) => `${id.providerTitle}-${id.itemId}`);
      if (typeof payload.index === "undefined") {
        return {
          ...state,
          context_items: state.context_items.filter(
            (item) =>
              !ids.includes(`${item.id.providerTitle}-${item.id.itemId}`)
          ),
        };
      } else {
        return {
          ...state,
          history: state.history.map((step, i) => {
            if (i === payload.index) {
              return {
                ...step,
                params: {
                  ...step.params,
                  context_items: (step.params?.context_items as any).filter(
                    (item: ContextItem) =>
                      !ids.includes(
                        `${item.id.providerTitle}-${item.id.itemId}`
                      )
                  ),
                },
              };
            }
            return step;
          }),
        };
      }
    },
    clearContextItems: (state: SessionFullState) => {
      return {
        ...state,
        context_items: [],
      };
    },
    setEditingAtIds: (
      state: SessionFullState,
      {
        payload,
      }: { payload: { ids: ContextItemId[]; index: number | undefined } }
    ) => {
      const ids = payload.ids.map((id) => id.itemId);

      if (typeof payload.index === "undefined") {
        return {
          ...state,
          context_items: state.context_items.map((item) => {
            return {
              ...item,
              editing: ids.includes(item.id.itemId),
            };
          }),
        };
      } else {
        return {
          ...state,
          history: state.history.map((step, i) => {
            if (i === payload.index) {
              return {
                ...step,
                params: {
                  ...step.params,
                  context_items: (step.params?.context_items as any).map(
                    (item: ContextItem) => {
                      return {
                        ...item,
                        editing: ids.includes(item.id.itemId),
                      };
                    }
                  ),
                },
              };
            }
            return step;
          }),
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
  clearContextItems,
} = sessionStateSlice.actions;
export default sessionStateSlice.reducer;
