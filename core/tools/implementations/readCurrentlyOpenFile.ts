import { getUriDescription } from "../../util/uri";

import { ToolImpl } from ".";

export const readCurrentlyOpenFileImpl: ToolImpl = async (args, extras) => {
  const result = await extras.ide.getCurrentFile();

  if (!result) {
    return [];
  }

  const { relativePathOrBasename, last2Parts, baseName } = getUriDescription(
    result.path,
    await extras.ide.getWorkspaceDirs(),
  );

  return [
    {
      name: `Current file: ${baseName}`,
      description: last2Parts,
      content: `\`\`\`${relativePathOrBasename}\n${result.contents}\n\`\`\``,
      uri: {
        type: "file",
        value: result.path,
      },
    },
  ];
};
