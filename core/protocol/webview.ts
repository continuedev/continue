import type { ContextItemWithId, IndexingProgressUpdate } from "../index.js";
import type  { AiderState } from "../../extensions/vscode/src/integrations/aider/types/aiderTypes";

export type ToWebviewFromIdeOrCoreProtocol = {
  configUpdate: [undefined, void];
  getDefaultModelTitle: [undefined, string];
  loadMostRecentChat: [undefined, void];
  indexProgress: [IndexingProgressUpdate, void];
  setAiderProcessStateInGUI: [AiderState, void];
  refreshSubmenuItems: [undefined, void];
  isContinueInputFocused: [undefined, boolean];
  pearAISignedIn: [undefined, void];
  addContextItem: [
    {
      historyIndex: number;
      item: ContextItemWithId;
    },
    void,
  ];
};
