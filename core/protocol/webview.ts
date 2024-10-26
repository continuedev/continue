import type { ContextItemWithId, IndexingProgressUpdate } from "../index.js";
import type { AiderStatusUpdate } from "../llm/llms/Aider";

export type ToWebviewFromIdeOrCoreProtocol = {
  addPearAIModel: [undefined, void];
  configUpdate: [undefined, void];
  getDefaultModelTitle: [undefined, string];
  loadMostRecentChat: [undefined, void];
  indexProgress: [IndexingProgressUpdate, void];
  aiderProcessStateUpdate: [AiderStatusUpdate, void];
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
