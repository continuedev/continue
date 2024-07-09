import type { ContextItemWithId, IndexingProgressUpdate } from "..";
import { ReviewResult } from "../review/review";

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
  "review/open": [undefined, void];
  "review/update": [ReviewResult[], void];
};
