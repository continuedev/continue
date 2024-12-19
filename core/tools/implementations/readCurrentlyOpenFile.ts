import { getUriPathBasename } from "../../util/uri";

import { ToolImpl } from ".";

export const readCurrentlyOpenFileImpl: ToolImpl = async (args, extras) => {
  const result = await extras.ide.getCurrentFile();

  if (!result) {
    return [];
  }

  const basename = getUriPathBasename(result.path);

  return [
    {
      name: "Current file",
      description: basename,
      content: `\`\`\`${basename}\n${result.contents}\n\`\`\``,
      uri: {
        type: "file",
        value: result.path,
      },
    },
  ];
};
