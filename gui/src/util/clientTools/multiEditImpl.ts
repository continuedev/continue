import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { ClientToolImpl } from "./callClientTool";

interface EditOperation {
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

function validateEdits(edits: EditOperation[]): void {
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    if (!edit.old_string && edit.old_string !== "") {
      throw new Error(`Edit ${i + 1}: old_string is required`);
    }
    if (edit.new_string === undefined) {
      throw new Error(`Edit ${i + 1}: new_string is required`);
    }
    if (edit.old_string === edit.new_string) {
      throw new Error(
        `Edit ${i + 1}: old_string and new_string must be different`,
      );
    }
  }
}

function applyEdit(
  content: string,
  edit: EditOperation,
  editIndex: number,
  isFirstEditOfNewFile: boolean,
): string {
  const { old_string, new_string, replace_all = false } = edit;

  // For new file creation, the first edit can have empty old_string
  if (isFirstEditOfNewFile && old_string === "") {
    return new_string;
  }

  // Check if old_string exists in current content
  if (!content.includes(old_string)) {
    throw new Error(
      `Edit ${editIndex + 1}: String not found in file: "${old_string}"`,
    );
  }

  if (replace_all) {
    // Replace all occurrences
    return content.split(old_string).join(new_string);
  } else {
    // Replace only the first occurrence, but check for uniqueness
    const occurrences = content.split(old_string).length - 1;
    if (occurrences > 1) {
      throw new Error(
        `Edit ${editIndex + 1}: String "${old_string}" appears ${occurrences} times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.`,
      );
    }
    return content.replace(old_string, new_string);
  }
}

export const multiEditImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { filepath, edits } = args;

  const streamId = uuid();

  // Validate arguments
  if (!filepath) {
    throw new Error("filepath is required");
  }
  if (!edits || !Array.isArray(edits) || edits.length === 0) {
    throw new Error(
      "edits array is required and must contain at least one edit",
    );
  }

  // Validate each edit operation
  validateEdits(edits);

  // Check if this is creating a new file (first edit has empty old_string)
  const isCreatingNewFile = edits[0].old_string === "";

  // Resolve the file path
  const resolvedFilepath = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );

  // For new files, resolvedFilepath might be null, so we construct the path
  const targetFilepath = resolvedFilepath || filepath;

  if (!isCreatingNewFile) {
    // For existing files, check if file exists
    if (!resolvedFilepath) {
      throw new Error(`File ${filepath} does not exist`);
    }
  }

  try {
    // Read current file content (or start with empty for new files)
    let currentContent = "";
    if (!isCreatingNewFile) {
      currentContent = await extras.ideMessenger.ide.readFile(targetFilepath);
    }

    let newContent = currentContent;

    // Apply all edits sequentially
    for (let i = 0; i < edits.length; i++) {
      const isFirstEditOfNewFile = i === 0 && isCreatingNewFile;
      newContent = applyEdit(newContent, edits[i], i, isFirstEditOfNewFile);
    }

    // Apply the changes to the file
    await extras.ideMessenger.request("applyToFile", {
      streamId,
      toolCallId,
      text: newContent,
      filepath: targetFilepath,
      isSearchAndReplace: true,
    });

    // Return success - applyToFile will handle the completion state
    return {
      respondImmediately: false, // Let apply state handle completion
      output: undefined,
    };
  } catch (error) {
    throw new Error(
      `Failed to apply multi edit: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
