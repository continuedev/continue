import { resolveRelativePathInDir } from "../../util/ideUtils";
import { getUriPathBasename } from "../../util/uri";

import { ToolImpl } from ".";
import { getNumberArg, getStringArg } from "../parseArgs";
import { throwIfFileExceedsHalfOfContext } from "./readFileLimit";

export const readFileHeadImpl: ToolImpl = async (args, extras) => {
  const filepath = getStringArg(args, "filepath");
  const lines = getNumberArg(args, "lines");

  if (lines < 1) {
    throw new Error("lines must be 1 or greater");
  }

  const firstUriMatch = await resolveRelativePathInDir(filepath, extras.ide);
  if (!firstUriMatch) {
    throw new Error(
      `File "${filepath}" does not exist. You might want to check the path and try again.`,
    );
  }

  // Use the IDE's readRangeInFile method to read first N lines
  // Lines 1 to N (converted to 0-based: 0 to N-1)
  const content = await extras.ide.readRangeInFile(firstUriMatch, {
    start: {
      line: 0, // First line (0-based)
      character: 0,
    },
    end: {
      line: lines - 1, // Nth line (0-based)
      character: Number.MAX_SAFE_INTEGER, // Read to end of line
    },
  });

  await throwIfFileExceedsHalfOfContext(
    filepath,
    content,
    extras.config.selectedModelByRole.chat,
  );

  return [
    {
      name: getUriPathBasename(firstUriMatch),
      description: `${filepath} (first ${lines} lines)`,
      content,
      uri: {
        type: "file",
        value: firstUriMatch,
      },
    },
  ];
};