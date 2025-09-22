import { DiffLine } from "core";
import { Core } from "core/core";
import { DataLogger } from "core/data/log";
import { myersDiff } from "core/diff/myers";

import { ContinueGUIWebviewViewProvider } from "../ContinueGUIWebviewViewProvider";
import { editOutcomeTracker } from "../extension/EditOutcomeTracker";
import { VsCodeIde } from "../VsCodeIde";

import { VerticalDiffManager } from "./vertical/manager";

/**
 * 计算模型生成的代码行数
 */
function calculateGeneratedCodeLines(diffLines: DiffLine[]): number {
  let addedLines = 0;

  for (const diffLine of diffLines) {
    if (diffLine.type === "new") {
      addedLines++;
    }
  }

  return addedLines;
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
): Promise<number | undefined> {
  let newOrCurrentUri = newFileUri;
  if (!newOrCurrentUri) {
    const currentFile = await ide.getCurrentFile();
    newOrCurrentUri = currentFile?.path;
  }
  if (!newOrCurrentUri) {
    console.warn(
      `No file provided or current file open while attempting to resolve diff`,
    );
    return undefined;
  }

  await ide.openFile(newOrCurrentUri);

  // If streamId is not provided, try to get it from the VerticalDiffManager
  if (!streamId) {
    streamId = verticalDiffManager.getStreamIdForFile(newOrCurrentUri);
  }

  // 获取模型生成的代码行数（仅在accept时）
  let generatedLines: number | undefined;

  if (action === "accept") {
    // 获取VerticalDiffManager中的logDiffs来计算生成的代码行数
    const logDiffs = verticalDiffManager.logDiffs;
    if (logDiffs && logDiffs.length > 0) {
      generatedLines = calculateGeneratedCodeLines(logDiffs);
      console.log("=== AcceptDiff Statistics ===");
      console.log("Generated code lines:", generatedLines);
      console.log("=== AcceptDiff Statistics End ===");
    } else {
      console.warn("No diff information available for statistics calculation");
    }
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

  // 返回生成的代码行数
  return generatedLines;
}
