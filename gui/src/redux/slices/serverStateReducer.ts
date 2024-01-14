import { createSlice } from "@reduxjs/toolkit";
import FreeTrial from "core/llm/llms/FreeTrial";
import { RootStore } from "../store";

const TEST_SLASH_COMMANDS = [
  {
    name: "edit",
    description: "Edit the code",
  },
  {
    name: "cmd",
    description: "Generate a command",
  },
  {
    name: "help",
    description: "Get help using Continue",
  },
];

const initialState: RootStore["serverState"] = {
  meilisearchUrl: undefined,
  slashCommands: [],
  selectedContextItems: [],
  config: {
    models: [
      new FreeTrial({ model: "gpt-4" }),
      new FreeTrial({ model: "gpt-3.5-turbo" }),
    ],
  },
  contextProviders: [],
  savedContextGroups: [],
  indexingProgress: 1.0,
};

export const serverStateSlice = createSlice({
  name: "serverState",
  initialState,
  reducers: {
    setSlashCommands: (state, action) => {
      return {
        ...state,
        slashCommands: [
          ...action.payload,
          { name: "codebase", description: "Retrieve codebase context" },
          { name: "so", description: "Search StackOverflow" },
        ],
      };
    },
    setContextProviders: (state, action) => {
      return {
        ...state,
        contextProviders: action.payload,
      };
    },
    setIndexingProgress: (state, { payload }: { payload: number }) => {
      return {
        ...state,
        indexingProgress: payload,
      };
    },
  },
});

export const { setContextProviders, setSlashCommands, setIndexingProgress } =
  serverStateSlice.actions;
export default serverStateSlice.reducer;
