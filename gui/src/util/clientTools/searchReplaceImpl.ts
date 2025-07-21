import { findSearchMatch } from "core/edit/searchAndReplace/findSearchMatch";
import { parseAllSearchReplaceBlocks } from "core/edit/searchAndReplace/parseSearchReplaceBlock";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import posthog from "posthog-js";
import { v4 as uuid } from "uuid";
import { ClientToolImpl } from "./callClientTool";

export const searchReplaceToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const { filepath, diffs } = args;

  const state = extras.getState();
  const allowAnonymousTelemetry = state.config.config.allowAnonymousTelemetry;

  const streamId = uuid();

  // Resolve the file path
  const resolvedFilepath = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );
  if (!resolvedFilepath) {
    throw new Error(`File ${filepath} does not exist`);
  }

  // Parse all search/replace blocks from all diff strings
  const allBlocks = [];
  for (let diffIndex = 0; diffIndex < diffs.length; diffIndex++) {
    const blocks = parseAllSearchReplaceBlocks(diffs[diffIndex]);
    if (blocks.length === 0) {
      throw new Error(
        `No complete search/replace blocks found in diff ${diffIndex + 1}`,
      );
    }
    allBlocks.push(...blocks);
  }

  if (allBlocks.length === 0) {
    throw new Error("No complete search/replace blocks found in any diffs");
  }

  try {
    // Read the current file content
    const originalContent =
      await extras.ideMessenger.ide.readFile(resolvedFilepath);
    let currentContent = originalContent;

    // Apply all replacements sequentially to build the final content
    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];
      const { searchContent, replaceContent } = block;

      // Find the search content in the current state of the file
      const match = findSearchMatch(currentContent, searchContent || "");

      // Because we don't have access to use hooks, we check `allowAnonymousTelemetry`
      // directly rather than using `CustomPostHogProvider`
      if (allowAnonymousTelemetry) {
        // Capture telemetry for tool calls
        posthog.capture("find_replace_match_result", {
          matchStrategy: match?.strategyName ?? "noMatch",
        });
      }

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
    // This works becaues of our logic in `applyCodeBlock` that determines
    // that the full file rewrite here can be applied instantly, so the diff
    // lines are just st
    await extras.ideMessenger.request("applyToFile", {
      streamId,
      toolCallId,
      text: currentContent,
      filepath: resolvedFilepath,
      isSearchAndReplace: true,
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
