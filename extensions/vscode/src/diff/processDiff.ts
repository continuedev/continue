import { Core } from "core/core";
import { ContinueGUIWebviewViewProvider } from "../ContinueGUIWebviewViewProvider";
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

  // Clear vertical diffs depending on action
  verticalDiffManager.clearForfileUri(newOrCurrentUri, action === "accept");
  if (action === "reject") {
    // this is so that IDE reject diff command can also cancel apply
    core.invoke("cancelApply", undefined);
  }

  if (streamId) {
    const fileContent = await ide.readFile(newOrCurrentUri);

    await sidebar.webviewProtocol.request("updateApplyState", {
      fileContent,
      filepath: newOrCurrentUri,
      streamId,
      status: "closed",
      numDiffs: 0,
      toolCallId,
    });
  }

  // Save the file
  await ide.saveFile(newOrCurrentUri);
}
