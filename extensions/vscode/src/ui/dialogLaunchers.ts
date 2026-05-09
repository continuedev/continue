import type {
  VSCodeBridgeDialogRequest,
  VSCodeBridgeDialogResponse,
} from "core/agent/contracts/index.js";

import { showVSCodeBridgeDialog } from "../extension/showVSCodeBridgeDialog";

export interface DialogLaunchers {
  showBridgeDialog(
    request: VSCodeBridgeDialogRequest,
  ): Promise<VSCodeBridgeDialogResponse>;
}

export function createDialogLaunchers(
  overrides?: Partial<DialogLaunchers>,
): DialogLaunchers {
  return {
    showBridgeDialog: overrides?.showBridgeDialog ?? showVSCodeBridgeDialog,
  };
}
