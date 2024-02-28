import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import {
  ContextProviderDescription,
  ContinueConfig,
  SlashCommandDescription,
} from "core";
import FreeTrial from "core/llm/llms/FreeTrial";

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

type ServerState = {
  meilisearchUrl: string | undefined;
  slashCommands: SlashCommandDescription[];
  selectedContextItems: any[];
  config: ContinueConfig;
  contextProviders: ContextProviderDescription[];
  savedContextGroups: any[]; // TODO: Context groups
  indexingProgress: number;
};

const initialState: ServerState = {
  meilisearchUrl: undefined,
  slashCommands: [],
  selectedContextItems: [],
  config: {
    models: [
      new FreeTrial({ model: "gpt-4" }),
      new FreeTrial({ model: "gpt-3.5-turbo" }),
    ],
  } as any,
  contextProviders: [],
  savedContextGroups: [],
  indexingProgress: 1.0,
};

export const serverStateSlice = createSlice({
  name: "serverState",
  initialState,
  reducers: {
    setSlashCommands: (
      state,
      action: PayloadAction<ServerState["slashCommands"]>
    ) => {
      state.slashCommands = [
        ...action.payload,
        { name: "codebase", description: "Retrieve codebase context" },
        { name: "so", description: "Search StackOverflow" },
      ];
    },
    setContextProviders: (
      state,
      action: PayloadAction<ServerState["contextProviders"]>
    ) => {
      state.contextProviders = action.payload;
    },
    setIndexingProgress: (
      state,
      action: PayloadAction<ServerState["indexingProgress"]>
    ) => {
      state.indexingProgress = action.payload;
    },
  },
});

export const { setContextProviders, setSlashCommands, setIndexingProgress } =
  serverStateSlice.actions;
export default serverStateSlice.reducer;
