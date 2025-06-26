import { ContextItem } from "core";
import { findSearchMatch } from "core/edit/searchAndReplace/findSearchMatch";
import { parseSearchReplaceBlock } from "core/edit/searchAndReplace/parseSearchReplaceBlock";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { ClientToolImpl } from "./callClientTool";

export const searchReplaceToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { filepath, diff } = args;

  // Resolve the file path
  const resolvedFilepath = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );
  if (!resolvedFilepath) {
    throw new Error(`File ${filepath} does not exist`);
  }

  // Parse the search/replace block from the diff content
  const parseResult = parseSearchReplaceBlock(diff);

  if (parseResult.error) {
    throw new Error(`Parse error: ${parseResult.error}`);
  }

  if (!parseResult.isComplete) {
    throw new Error("Incomplete search/replace block");
  }

  const { searchContent, replaceContent } = parseResult;

  try {
    // Read the current file content
    const fileContent =
      await extras.ideMessenger.ide.readFile(resolvedFilepath);

    // Find the search match
    const match = findSearchMatch(fileContent, searchContent || "");

    if (!match) {
      throw new Error(`Search content not found in file:\n${searchContent}`);
    }

    // Apply the replacement
    const newContent =
      fileContent.substring(0, match.startIndex) +
      (replaceContent || "") +
      fileContent.substring(match.endIndex);

    // Write the updated file
    await extras.ideMessenger.request("writeFile", {
      path: resolvedFilepath,
      contents: newContent,
    });

    // Create context item showing the change
    const contextItem: ContextItem = {
      name: `Modified ${filepath}`,
      description: `Applied search and replace to ${filepath}`,
      content: `Search and replace operation completed successfully.

Search content:
\`\`\`
${searchContent}
\`\`\`

Replace content:
\`\`\`
${replaceContent}
\`\`\`

File: ${filepath}`,
      editing: true,
    };

    return {
      respondImmediately: true,
      output: [contextItem],
    };
  } catch (error) {
    throw new Error(
      `Failed to apply search and replace: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
