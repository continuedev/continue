import { Core } from "core/core";
import { DataLogger } from "core/data/log";

import { ContinueGUIWebviewViewProvider } from "../ContinueGUIWebviewViewProvider";
import { editOutcomeTracker } from "../extension/EditOutcomeTracker";
import { createPrettyPatch, normalizeContent } from "../util/diffUtils";
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
    // Capture file content before save to detect autoformatting
    const preSaveContent = await ide.readFile(newOrCurrentUri);

    // Record the edit outcome before updating the apply state
    await editOutcomeTracker.recordEditOutcome(
      streamId,
      action === "accept",
      DataLogger.getInstance(),
    );

    // Save the file
    await ide.saveFile(newOrCurrentUri);

    // Capture file content after save to detect autoformatting
    const postSaveContent = await ide.readFile(newOrCurrentUri);

    // Detect autoformatting by comparing normalized content
    let autoFormattingDiff: string | undefined;
    const normalizedPreSave = normalizeContent(preSaveContent);
    const normalizedPostSave = normalizeContent(postSaveContent);

    if (normalizedPreSave !== normalizedPostSave) {
      // Auto-formatting was applied by the editor
      autoFormattingDiff = createPrettyPatch(
        newOrCurrentUri,
        preSaveContent,
        postSaveContent,
      );
    }

    await sidebar.webviewProtocol.request("updateApplyState", {
      fileContent: postSaveContent, // Use post-save content
      filepath: newOrCurrentUri,
      streamId,
      status: "closed",
      numDiffs: 0,
      toolCallId,
      autoFormattingDiff, // Include autoformatting diff
    });
  } else {
    // Save the file even if no streamId
    await ide.saveFile(newOrCurrentUri);
  }
}
