import { findSearchMatch } from "core/edit/searchAndReplace/findSearchMatch";
import { parseAllSearchReplaceBlocks } from "core/edit/searchAndReplace/parseSearchReplaceBlock";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { ClientToolImpl } from "./callClientTool";

export const searchReplaceToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { filepath, diff } = args;

  // Check if we have a streamId from a pre-existing apply state
  if (!extras.streamId) {
    throw new Error("Invalid apply state - no streamId available");
  }

  // Resolve the file path
  const resolvedFilepath = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );
  if (!resolvedFilepath) {
    throw new Error(`File ${filepath} does not exist`);
  }

  // Parse all search/replace blocks from the diff content
  const blocks = parseAllSearchReplaceBlocks(diff);

  if (blocks.length === 0) {
    throw new Error("No complete search/replace blocks found");
  }

  try {
    // Read the current file content
    const originalContent =
      await extras.ideMessenger.ide.readFile(resolvedFilepath);
    let currentContent = originalContent;

    // Apply all replacements sequentially to build the final content
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const { searchContent, replaceContent } = block;

      // Find the search content in the current state of the file
      const match = findSearchMatch(currentContent, searchContent || "");
      if (!match) {
        throw new Error(
          `Search content not found in block ${i + 1}:\n${searchContent}`,
        );
      }

      // Apply the replacement
      currentContent =
        currentContent.substring(0, match.startIndex) +
        (replaceContent || "") +
        currentContent.substring(match.endIndex);
    }

    // Single applyToFile call with all accumulated changes
    await extras.ideMessenger.request("applyToFile", {
      text: currentContent,
      streamId: extras.streamId,
      filepath: resolvedFilepath,
      toolCallId,
    });

    // Return success - applyToFile will handle the completion state
    return {
      respondImmediately: false, // Let apply state handle completion
      output: undefined,
    };
  } catch (error) {
    throw new Error(
      `Failed to apply search and replace: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
