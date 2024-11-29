import { ToolImpl } from ".";
import { getBasename } from "../../util";

export const readCurrentlyOpenFileImpl: ToolImpl = async (args, extras) => {
  const result = await extras.ide.getCurrentFile();

  if (!result) {
    return [];
  }

  const basename = getBasename(result.path);

  return [
    {
      name: "Current file",
      description: basename,
      content: `\`\`\`${basename}\n${result.contents}\n\`\`\``,
    },
  ];
};
