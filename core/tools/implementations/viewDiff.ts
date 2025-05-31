import { ToolImpl } from ".";
import { getDiffsFromCache } from "../../autocomplete/snippets/gitDiffCache";

export const viewDiffImpl: ToolImpl = async (args, extras) => {
  const diffs = await getDiffsFromCache(extras.ide); // const diffs = await extras.ide.getDiff(true);
  // TODO includeUnstaged should be an option

  return [
    {
      name: "Diff",
      description: "The current git diff",
      content: diffs.join("\n"),
    },
  ];
};
