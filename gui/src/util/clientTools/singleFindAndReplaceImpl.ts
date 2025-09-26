import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";

export const singleFindAndReplaceImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  // Note, has preprocessed args at this point
  const { fileUri, newFileContents } = args;

  // Apply the changes to the file
  const streamId = uuid();
  void extras.dispatch(
    applyForEditTool({
      streamId,
      toolCallId,
      text: newFileContents,
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
