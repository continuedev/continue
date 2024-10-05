import type { ContextItemWithId, IndexingProgressUpdate } from "../index.js";

export type ToWebviewFromIdeOrCoreProtocol = {
  addPearAIModel: [undefined, void];
  configUpdate: [undefined, void];
  getDefaultModelTitle: [undefined, string];
  loadMostRecentChat: [undefined, void];
  indexProgress: [IndexingProgressUpdate, void];
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
