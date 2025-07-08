import { getUriDescription } from "../../util/uri";

import { ToolImpl } from ".";
import { formatCodeblock } from "../../util/formatCodeblock";
import { throwIfFileExceedsHalfOfContext } from "./readFileLimit";

export const readCurrentlyOpenFileImpl: ToolImpl = async (args, extras) => {
  const result = await extras.ide.getCurrentFile();

  if (result) {
    await throwIfFileExceedsHalfOfContext(
      result.path,
      result.contents,
      extras.config.selectedModelByRole.chat,
    );

    const workspaceDirs = await extras.ide.getWorkspaceDirs();

    const { relativePathOrBasename, last2Parts, baseName, extension } =
      getUriDescription(result.path, workspaceDirs);

    const codeblock = formatCodeblock(
      extension,
      relativePathOrBasename,
      result.contents,
    );

    return [
      {
        name: `Current file: ${baseName}`,
        description: last2Parts,
        content: codeblock,
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
