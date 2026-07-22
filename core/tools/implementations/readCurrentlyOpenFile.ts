import { getUriDescription } from "../../util/uri";

import { ToolImpl } from ".";
import { throwIfFileIsSecurityConcern } from "../../indexing/ignore";
import { throwIfFileExceedsHalfOfContext } from "./readFileLimit";

export const readCurrentlyOpenFileImpl: ToolImpl = async (_, extras) => {
  const result = await extras.ide.getCurrentFile();

  if (result) {
    throwIfFileIsSecurityConcern(result.path);
    await throwIfFileExceedsHalfOfContext(
      result.path,
      result.contents,
      extras.config.selectedModelByRole.chat,
    );

    const { last2Parts, baseName } = getUriDescription(
      result.path,
      await extras.ide.getWorkspaceDirs(),
    );

    return [
      {
        name: `Current file: ${baseName}`,
        description: last2Parts,
        content: result.contents,
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
