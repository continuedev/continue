import { getUriDescription } from "../../util/uri";

import { ToolImpl } from ".";
import { throwIfFileExceedsHalfOfContext } from "./readFileLimit";

export const readCurrentlyOpenFileImpl: ToolImpl = async (args, extras) => {
  const result = await extras.ide.getCurrentFile();

  if (result) {
    await throwIfFileExceedsHalfOfContext(
      result.path,
      result.contents,
      extras.config.selectedModelByRole.chat,
    );

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
  } else {
    return [
      {
        name: `No Current File`,
        description: "",
        content: "There are no files currently open.",
      },
    ];
  }
};
