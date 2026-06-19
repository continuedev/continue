import { Core } from "core/core";
import { DataLogger } from "core/data/log";
import { myersDiff } from "core/diff/myers";

import { ContinueGUIWebviewViewProvider } from "../ContinueGUIWebviewViewProvider";
import { editOutcomeTracker } from "../extension/EditOutcomeTracker";
import { VsCodeIde } from "../VsCodeIde";

import { VerticalDiffManager } from "./vertical/manager";

async function processSingleFileDiff(
  action: "accept" | "reject",
  sidebar: ContinueGUIWebviewViewProvider,
  ide: VsCodeIde,
  verticalDiffManager: VerticalDiffManager,
  fileUri: string,
  streamId?: string,
  toolCallId?: string,
) {
  await ide.openFile(fileUri);

  // If streamId is not provided, try to get it from the VerticalDiffManager
  if (!streamId) {
    streamId = verticalDiffManager.getStreamIdForFile(fileUri);
  }

  // Clear vertical diffs depending on action
  verticalDiffManager.clearForfileUri(fileUri, action === "accept");

  if (streamId) {
    // Capture file content before save to detect autoformatting
    const preSaveContent = await ide.readFile(fileUri);

    await editOutcomeTracker.recordEditOutcome(
      streamId,
      action === "accept",
      DataLogger.getInstance(),
    );

    // Save the file
    await ide.saveFile(fileUri);

    // Capture file content after save to detect autoformatting
    const postSaveContent = await ide.readFile(fileUri);

    // Detect autoformatting by comparing normalized content
    let autoFormattingDiff: string | undefined;
    const normalizedPreSave = preSaveContent.trim();
    const normalizedPostSave = postSaveContent.trim();

    if (normalizedPreSave !== normalizedPostSave) {
      // Auto-formatting was applied by the editor
      const diffLines = myersDiff(preSaveContent, postSaveContent);
      autoFormattingDiff = diffLines
        .map((line) => {
          switch (line.type) {
            case "old":
              return `-${line.line}`;
            case "new":
              return `+${line.line}`;
            case "same":
              return ` ${line.line}`;
          }
        })
        .join("\n");
    }

    await sidebar.webviewProtocol.request("updateApplyState", {
      fileContent: postSaveContent, // Use post-save content
      filepath: fileUri,
      streamId,
      status: "closed",
      numDiffs: 0,
      toolCallId,
      autoFormattingDiff, // Include autoformatting diff
    });
  } else {
    // Save the file even if no streamId
    await ide.saveFile(fileUri);
  }
}

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
  if (action === "reject") {
    core.invoke("cancelApply", undefined);
  }

  let fileUriToProcess = newFileUri;

  if (!fileUriToProcess) {
    const allFilesWithDiffs = verticalDiffManager.getAllFilesWithDiffs();
    if (allFilesWithDiffs.length > 0) {
      fileUriToProcess = allFilesWithDiffs[0].fileUri;
      streamId = allFilesWithDiffs[0].streamId;
    }
  }

  if (!fileUriToProcess) {
    console.warn(
      `No file provided or current file open while attempting to resolve diff`,
    );
    return;
  }

  await processSingleFileDiff(
    action,
    sidebar,
    ide,
    verticalDiffManager,
    fileUriToProcess,
    streamId,
    toolCallId,
  );
}
