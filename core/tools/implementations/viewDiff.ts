import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { getDiffsFromCache } from "../../autocomplete/snippets/gitDiffCache";

export const DEFAULT_GIT_DIFF_LINE_LIMIT = 5000;

export const viewDiffImpl: ToolImpl = async (args, extras) => {
  const diffs = await getDiffsFromCache(extras.ide); // const diffs = await extras.ide.getDiff(true);
  // TODO includeUnstaged should be an option

  const combinedDiff = diffs.join("\n");

  if (!combinedDiff.trim()) {
    return [
      {
        name: "Diff",
        description: "current Git diff",
        content: "The current diff is empty",
      },
    ];
  }

  const diffLines = combinedDiff.split("\n");

  let truncated = false;
  let processedDiff = combinedDiff;

  if (diffLines.length > DEFAULT_GIT_DIFF_LINE_LIMIT) {
    truncated = true;
    processedDiff = diffLines.slice(0, DEFAULT_GIT_DIFF_LINE_LIMIT).join("\n");
  }

  const contextItems: ContextItem[] = [
    {
      name: "Diff",
      description: "The current git diff",
      content: processedDiff,
    },
  ];

  if (truncated) {
    contextItems.push({
      name: "Truncation warning",
      description: "",
      content: `The git diff was truncated because it exceeded ${DEFAULT_GIT_DIFF_LINE_LIMIT} lines. Consider viewing specific files or focusing on smaller changes.`,
    });
  }

  return contextItems;
};
