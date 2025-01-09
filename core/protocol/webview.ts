import { ConfigResult } from "../config/load.js";
import { ConfigValidationError } from "../config/validation.js";

import type {
  BrowserSerializedContinueConfig,
  ContextItemWithId,
  IndexingProgressUpdate,
  IndexingStatus,
  PackageDocsResult,
} from "../index.js";

export type ToWebviewFromIdeOrCoreProtocol = {
  configUpdate: [
    {
      result: ConfigResult<BrowserSerializedContinueConfig>;
      profileId: string;
    },
    void,
  ];
  configError: [ConfigValidationError[] | undefined, void];
  getDefaultModelTitle: [undefined, string];
  indexProgress: [IndexingProgressUpdate, void]; // Codebase
  "indexing/statusUpdate": [IndexingStatus, void]; // Docs, etc.
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
  getCurrentSessionId: [undefined, string];
  signInToControlPlane: [undefined, void];
  openDialogMessage: ["account", void];
  "docs/suggestions": [PackageDocsResult[], void];
};
