import { ConfigValidationError } from "../config/validation.js";

import type { ContextItemWithId, IndexingProgressUpdate } from "../index.js";

export type ToWebviewFromIdeOrCoreProtocol = {
  configUpdate: [undefined, void];
  configError: [ConfigValidationError[] | undefined, void];
  openSelectedConfigProfile: [undefined, void];
  getDefaultModelTitle: [undefined, string];
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
  setTTSActive: [boolean, void];
  getWebviewHistoryLength: [undefined, number];
  signInToControlPlane: [undefined, void];
  openDialogMessage: ["profileSwitcher", void];
};
