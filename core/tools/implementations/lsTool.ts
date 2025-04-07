import { ToolImpl } from ".";
import { walkDir } from "../../indexing/walkDir";
import { resolveRelativePathInDir } from "../../util/ideUtils";

export const lsToolImpl: ToolImpl = async (args, extras) => {
  const uri = await resolveRelativePathInDir(args.dirPath, extras.ide);
  if (!uri) {
    throw new Error(
      `Directory ${args.dirPath} not found. Make sure to use forward-slash paths. Do not use e.g. "."`,
    );
  }

  const entries = await walkDir(uri, extras.ide, {
    returnRelativeUrisPaths: true,
    include: "both",
    recursive: args.recursive ?? false,
  });

  const content =
    entries.length > 0
      ? entries.join("\n")
      : `No files/folders found in ${args.dirPath}`;

  return [
    {
      name: "File/folder list",
      description: `Files/folders in ${args.dirPath}`,
      content,
    },
  ];
};
