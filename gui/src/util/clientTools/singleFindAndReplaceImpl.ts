import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";
import {
  performFindAndReplace,
  validateSingleEdit,
} from "./findAndReplaceUtils";

export async function validateAndEnhanceSingleEditArgs(
  args: Record<string, any>,
  ideMessenger: IIdeMessenger,
): Promise<Record<string, any>> {
  const { filepath, old_string, new_string, replace_all = false } = args;

  // Validate arguments
  if (!filepath) {
    throw new Error("filepath is required");
  }
  validateSingleEdit(old_string, new_string);

  // Resolve the file path
  const resolvedFileUri = await resolveRelativePathInDir(
    filepath,
    ideMessenger.ide,
  );
  if (!resolvedFileUri) {
    throw new Error(`File ${filepath} does not exist`);
  }

  // Read the current file content
  const originalContent = await ideMessenger.ide.readFile(resolvedFileUri);

  // Perform the find and replace operation
  const newContent = performFindAndReplace(
    originalContent,
    old_string,
    new_string,
    replace_all,
  );

  return {
    old_string,
    new_string,
    replace_all,
    originalContent,
    newContent,
    fileUri: resolvedFileUri,
  };
}

export const singleFindAndReplaceImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { newContent, fileUri } = args;
  const streamId = uuid();

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
