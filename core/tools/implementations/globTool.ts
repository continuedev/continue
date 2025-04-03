import { ToolImpl } from ".";
import { walkDir } from "../../indexing/walkDir";
import { resolveRelativePathInDir } from "../../util/ideUtils";

export const globToolImpl: ToolImpl = async (args, extras) => {
  const uri = await resolveRelativePathInDir(args.dirPath, extras.ide);
  if (!uri) {
    throw new Error(
      `Directory ${args.path} not found. Make sure to use forward-slash paths. Do not use e.g. "."`,
    );
  }

  const entries = await walkDir(uri, extras.ide, {
    returnRelativeUrisPaths: true,
    include: "both",
    recursive: args.recursive ?? false,
    source: "LS tool",
  });

  const content =
    entries.length > 0
      ? entries.join("\n")
      : `No files/folders found in ${args.path}`;

  return [
    {
      name: "File search results",
      description: `Files search results${args.path ? " in " + args.path : ""}`,
      content,
    },
  ];
};
