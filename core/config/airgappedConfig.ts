import { ContinueConfig } from "../index.js";
import Ollama from "../llm/llms/Ollama.js";

const ollamaChat = new Ollama({
  title: "Ollama Llama3",
  model: "llama3:8b",
  apiBase: "http://127.0.0.1:11434",
});

export const AIRGAPPED_CONFIG: ContinueConfig = {
  // flags
  disableIndexing: true,
  allowAnonymousTelemetry: false,

  // REQUIRED arrays (must exist, can be empty)
  slashCommands: [],
  contextProviders: [],
  tools: [],
  mcpServerStatuses: [],
  rules: [],

  // REQUIRED model wiring
  modelsByRole: {
    chat: [ollamaChat],
    autocomplete: [],
    embed: [],
    rerank: [],
    edit: [],
    apply: [],
    summarize: [],
    subagent: [],
  },

  selectedModelByRole: {
    chat: ollamaChat,
    autocomplete: null,
    embed: null,
    rerank: null,
    edit: null,
    apply: null,
    summarize: null,
    subagent: null,
  },
};
