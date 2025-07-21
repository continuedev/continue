import { resolveRelativePathInDir } from "../../util/ideUtils";
import { getUriPathBasename } from "../../util/uri";

import { ToolImpl } from ".";
import { getStringArg } from "../parseArgs";
import { throwIfFileExceedsHalfOfContext } from "./readFileLimit";

export const readFileImpl: ToolImpl = async (args, extras) => {
  const filepath = getStringArg(args, "filepath");

  const firstUriMatch = await resolveRelativePathInDir(filepath, extras.ide);
  if (!firstUriMatch) {
    throw new Error(`Could not find file ${filepath}`);
  }
  const content = await extras.ide.readFile(firstUriMatch);

  await throwIfFileExceedsHalfOfContext(
    filepath,
    content,
    extras.config.selectedModelByRole.chat,
  );

  return [
    {
      name: getUriPathBasename(firstUriMatch),
      description: filepath,
      content,
      uri: {
        type: "file",
        value: firstUriMatch,
      },
    },
  ];
};
