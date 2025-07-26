import { ContextItem } from "core";
import { findSearchMatch } from "core/edit/searchAndReplace/findSearchMatch";
import { parseAllSearchReplaceBlocks } from "core/edit/searchAndReplace/parseSearchReplaceBlock";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import posthog from "posthog-js";
import { v4 as uuid } from "uuid";
import { updateToolCallOutput } from "../../redux/slices/sessionSlice";
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
    const appliedBlocks: string[] = [];

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

      // Track what was actually replaced
      const originalSection = currentContent.substring(
        match.startIndex,
        match.endIndex,
      );
      const replacementText = replaceContent || "";
      if (originalSection === replacementText) {
        appliedBlocks.push(
          `Block ${i + 1}: No changes needed (content already matches)`,
        );
      } else {
        const originalPreview =
          originalSection.length > 100
            ? originalSection.substring(0, 97) + "..."
            : originalSection;
        const replacementPreview =
          replacementText.length > 100
            ? replacementText.substring(0, 97) + "..."
            : replacementText;
        appliedBlocks.push(
          `Block ${i + 1}: Replaced "${originalPreview}" with "${replacementPreview}"`,
        );
      }

      // Apply the replacement
      currentContent =
        currentContent.substring(0, match.startIndex) +
        replacementText +
        currentContent.substring(match.endIndex);
    }

    // Single applyToFile call with all accumulated changes
    await extras.ideMessenger.request("applyToFile", {
      streamId,
      toolCallId,
      text: currentContent,
      filepath: resolvedFilepath,
      isSearchAndReplace: true,
    });

    // Store success information for later LLM feedback
    const successOutput: ContextItem[] = [
      {
        name: "Search and Replace Results",
        description: `Successfully applied ${allBlocks.length} replacements to ${filepath}`,
        content: [
          `Successfully modified ${filepath}`,
          `Applied ${allBlocks.length} search/replace operations:`,
          ...appliedBlocks,
          ``,
          `File changes are being applied by the IDE.`,
        ].join("\n"),
      },
    ];

    // Store the success output - this will be used when apply state completes
    extras.dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: successOutput,
      }),
    );

    return {
      respondImmediately: false, // Let apply state handle completion
      output: undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorOutput: ContextItem[] = [
      {
        name: "Search and Replace Error",
        description: `Failed to apply changes to ${filepath}`,
        content: `Error: ${errorMessage}`,
      },
    ];

    // Store error output immediately since we won't get apply state updates on failure
    extras.dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: errorOutput,
      }),
    );

    // For errors, respond immediately so LLM gets feedback right away
    return {
      respondImmediately: true,
      output: errorOutput,
    };
  }
};
