import type { ContextItemWithId, IndexingProgressUpdate } from "../index.js";
import type { AiderState } from "../llm/llms/Aider";

export type ToWebviewFromIdeOrCoreProtocol = {
  addPearAIModel: [undefined, void];
  configUpdate: [undefined, void];
  getDefaultModelTitle: [undefined, string];
  loadMostRecentChat: [undefined, void];
  indexProgress: [IndexingProgressUpdate, void];
  aiderProcessStateUpdate: [AiderState, void];
  refreshSubmenuItems: [undefined, void];
  isContinueInputFocused: [undefined, boolean];
  addContextItem: [
    {
      historyIndex: number;
      item: ContextItemWithId;
    },
    void,
  ];
};
