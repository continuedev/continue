import type { ContextItemWithId, IndexingProgressUpdate } from "..";

export type ToWebviewFromIdeOrCoreProtocol = {
  configUpdate: [undefined, void];
  getDefaultModelTitle: [undefined, string];
  indexProgress: [IndexingProgressUpdate, void];
  refreshSubmenuItems: [undefined, void];
  addContextItem: [
    {
      historyIndex: number;
      item: ContextItemWithId;
    },
    void,
  ];
};
