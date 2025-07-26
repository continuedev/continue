import { Core } from "core/core";
import { DataLogger } from "core/data/log";
import { ContinueGUIWebviewViewProvider } from "../ContinueGUIWebviewViewProvider";
import { editOutcomeTracker } from "../extension/EditOutcomeTracker";
import { VsCodeIde } from "../VsCodeIde";
import { VerticalDiffManager } from "./vertical/manager";

export async function processDiff(
  action: "accept" | "reject",
  sidebar: ContinueGUIWebviewViewProvider,
  ide: VsCodeIde,
  core: Core,
  verticalDiffManager: VerticalDiffManager,
  newFileUri?: string,
  streamId?: string,
  toolCallId?: string,
) {
  let newOrCurrentUri = newFileUri;
  if (!newOrCurrentUri) {
    const currentFile = await ide.getCurrentFile();
    newOrCurrentUri = currentFile?.path;
  }
  if (!newOrCurrentUri) {
    console.warn(
      `No file provided or current file open while attempting to resolve diff`,
    );
    return;
  }

  await ide.openFile(newOrCurrentUri);

  // If streamId is not provided, try to get it from the VerticalDiffManager
  if (!streamId) {
    streamId = verticalDiffManager.getStreamIdForFile(newOrCurrentUri);
  }

  // Clear vertical diffs depending on action
  verticalDiffManager.clearForfileUri(newOrCurrentUri, action === "accept");
  // Note: We don't call cancelApply for manual diff rejection since the diffs
  // have completed streaming and we want to record the user's decision

  if (streamId) {
    // Record the edit outcome
    await editOutcomeTracker.recordEditOutcome(
      streamId,
      action === "accept",
      DataLogger.getInstance(),
    );

    // Note: We don't send updateApplyState here because VerticalDiffHandler.clear()
    // already sent the "closed" status with proper diff tracking data
  }

  // Save the file
  await ide.saveFile(newOrCurrentUri);
}
