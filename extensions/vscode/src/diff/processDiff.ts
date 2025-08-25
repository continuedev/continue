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
  if (action === "reject") {
    // this is so that IDE reject diff command can also cancel apply
    core.invoke("cancelApply", undefined);
  }

  if (streamId) {
    // Record the edit outcome before updating the apply state
    await editOutcomeTracker.recordEditOutcome(
      streamId,
      action === "accept",
      DataLogger.getInstance(),
    );

    // Note: We don't need to send updateApplyState here because the VerticalDiffHandler
    // already sends it with the correct acceptance counts in its clear() method.
    // Sending it again would overwrite the correct counts with zeros since the handler
    // gets disposed after calling clear().
  }

  // Save the file
  await ide.saveFile(newOrCurrentUri);
}
