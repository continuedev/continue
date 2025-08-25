import { resolveRelativePathInDir } from "../../util/ideUtils";
import { getUriPathBasename } from "../../util/uri";

import { ToolImpl } from ".";
import { getNumberArg, getStringArg } from "../parseArgs";
import { throwIfFileExceedsHalfOfContext } from "./readFileLimit";

export const readFileRangeImpl: ToolImpl = async (args, extras) => {
  const filepath = getStringArg(args, "filepath");
  const startLine = getNumberArg(args, "startLine");
  const endLine = getNumberArg(args, "endLine");

  // Validate that line numbers are positive integers
  if (startLine < 1) {
    throw new Error(
      "startLine must be 1 or greater. Negative line numbers are not supported - use the terminal tool with 'tail' command for reading from file end.",
    );
  }
  if (endLine < 1) {
    throw new Error(
      "endLine must be 1 or greater. Negative line numbers are not supported - use the terminal tool with 'tail' command for reading from file end.",
    );
  }
  if (endLine < startLine) {
    throw new Error(
      `endLine (${endLine}) must be greater than or equal to startLine (${startLine})`,
    );
  }

  const firstUriMatch = await resolveRelativePathInDir(filepath, extras.ide);
  if (!firstUriMatch) {
    throw new Error(
      `File "${filepath}" does not exist. You might want to check the path and try again.`,
    );
  }

  // Use the IDE's readRangeInFile method with 0-based range (IDE expects 0-based internally)
  const content = await extras.ide.readRangeInFile(firstUriMatch, {
    start: {
      line: startLine - 1, // Convert from 1-based to 0-based
      character: 0,
    },
    end: {
      line: endLine - 1, // Convert from 1-based to 0-based
      character: Number.MAX_SAFE_INTEGER, // Read to end of line
    },
  });

  await throwIfFileExceedsHalfOfContext(
    filepath,
    content,
    extras.config.selectedModelByRole.chat,
  );

  const rangeDescription = `${filepath} (lines ${startLine}-${endLine})`;

  return [
    {
      name: getUriPathBasename(firstUriMatch),
      description: rangeDescription,
      content,
      uri: {
        type: "file",
        value: firstUriMatch,
      },
    },
  ];
};
