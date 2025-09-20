import {
  validateAllEdits,
  validateMultiEditArgs,
} from "core/edit/searchAndReplace/multiEditValidation";
import { executeMultiFindAndReplace } from "core/edit/searchAndReplace/performReplace";
import { ContinueError, ContinueErrorReason } from "core/util/errors";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";

export const multiEditImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { filepath, editingFileContents } = args;

  const streamId = uuid();

  // Validate filepath (GUI specific)
  if (!filepath) {
    throw new ContinueError(
      ContinueErrorReason.FindAndReplaceMissingFilepath,
      "filepath is required",
    );
  }

  // Validate edits using shared logic
  const { edits } = validateMultiEditArgs(args);
  validateAllEdits(edits);

  const resolvedUri = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );

  if (!resolvedUri) {
    throw new ContinueError(
      ContinueErrorReason.FileNotFound,
      `file ${filepath} does not exist. This tool cannot create new files.`,
    );
  }

  const currentContent =
    editingFileContents ??
    (await extras.ideMessenger.ide.readFile(resolvedUri));
  const fileUri = resolvedUri;

  // Apply all edits using shared logic with findSearchMatch
  const newContent = executeMultiFindAndReplace(currentContent, edits);

  // Apply the changes to the file
  void extras.dispatch(
    applyForEditTool({
      streamId,
      toolCallId,
      text: newContent,
      filepath: fileUri,
      isSearchAndReplace: true,
    }),
  );

  // Return success - applyToFile will handle the completion state
  return {
    respondImmediately: false, // Let apply state handle completion
    output: undefined,
  };
};
