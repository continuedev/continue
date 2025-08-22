import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { handleEditToolApplyError } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";

export const singleFindAndReplaceImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { filepath, old_string, new_string, replace_all = false } = args;

  const streamId = uuid();

  // Validate arguments
  if (!filepath) {
    throw new Error("filepath is required");
  }
  if (!old_string) {
    throw new Error("old_string is required");
  }
  if (new_string === undefined) {
    throw new Error("new_string is required");
  }
  if (old_string === new_string) {
    throw new Error("old_string and new_string must be different");
  }

  // Resolve the file path
  const resolvedFilepath = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );
  if (!resolvedFilepath) {
    throw new Error(`File ${filepath} does not exist`);
  }

  try {
    // Read the current file content
    const originalContent =
      await extras.ideMessenger.ide.readFile(resolvedFilepath);

    // Check if old_string exists in the file
    if (!originalContent.includes(old_string)) {
      throw new Error(`String not found in file: ${old_string}`);
    }

    let newContent: string;

    if (replace_all) {
      // Replace all occurrences
      newContent = originalContent.split(old_string).join(new_string);
    } else {
      // Replace only the first occurrence
      const occurrences = originalContent.split(old_string).length - 1;
      if (occurrences > 1) {
        throw new Error(
          `String "${old_string}" appears ${occurrences} times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.`,
        );
      }
      newContent = originalContent.replace(old_string, new_string);
    }

    // Apply the changes to the file
    void extras.ideMessenger
      .request("applyToFile", {
        streamId,
        toolCallId,
        text: newContent,
        filepath: resolvedFilepath,
        isSearchAndReplace: true,
      })
      .then((res) => {
        if (res.status === "error") {
          void extras.dispatch(
            handleEditToolApplyError({
              toolCallId,
            }),
          );
        }
      });

    // Return success - applyToFile will handle the completion state
    return {
      respondImmediately: false, // Let apply state handle completion
      output: undefined,
    };
  } catch (error) {
    throw new Error(
      `Failed to apply find and replace: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
