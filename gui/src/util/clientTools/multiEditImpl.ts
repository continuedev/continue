import { validateMultiEdit } from "core/edit/searchAndReplace/multiEditValidation";
import { executeMultiFindAndReplace } from "core/edit/searchAndReplace/performReplace";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";
import { validateSearchAndReplaceFilepath } from "./singleFindAndReplaceImpl";

export const multiEditImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { filepath, editingFileContents } = args;

  const resolvedUri = await validateSearchAndReplaceFilepath(
    filepath,
    extras.ideMessenger.ide,
  );

  const { edits } = validateMultiEdit(args);

  const currentContent =
    editingFileContents ??
    (await extras.ideMessenger.ide.readFile(resolvedUri));
  const fileUri = resolvedUri;

  const newContent = executeMultiFindAndReplace(currentContent, edits);

  const streamId = uuid();
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
