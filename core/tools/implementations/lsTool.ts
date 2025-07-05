import { ToolImpl } from ".";
import { walkDir } from "../../indexing/walkDir";
import { resolveRelativePathInDir } from "../../util/ideUtils";

export function resolveLsToolDirPath(dirPath: string | undefined) {
  if (!dirPath || dirPath === ".") {
    return "/";
  }
  if (dirPath.startsWith(".")) {
    return dirPath.slice(1);
  }
  return dirPath.replace(/\\/g, "/");
}

const MAX_LS_TOOL_LINES = 200;

export const lsToolImpl: ToolImpl = async (args, extras) => {
  const dirPath = resolveLsToolDirPath(args?.dirPath);
  const uri = await resolveRelativePathInDir(dirPath, extras.ide);
  if (!uri) {
    throw new Error(
      `Directory ${args.dirPath} not found. Make sure to use forward-slash paths`,
    );
  }

  const entries = await walkDir(uri, extras.ide, {
    returnRelativeUrisPaths: true,
    include: "both",
    recursive: args?.recursive ?? false,
  });

  const lines = entries.slice(0, MAX_LS_TOOL_LINES);

  let content =
    lines.length > 0
      ? lines.join("\n")
      : `No files/folders found in ${dirPath}`;

  const contextItems = [
    {
      name: "File/folder list",
      description: `Files/folders in ${dirPath}`,
      content,
    },
  ];

  if (entries.length > MAX_LS_TOOL_LINES) {
    let warningContent = `${entries.length - MAX_LS_TOOL_LINES} ls entries were truncated`;
    if (args?.recursive) {
      warningContent += ". Try using a non-recursive search";
    }
    contextItems.push({
      name: "ls truncation warning",
      description: "Informs the model that ls results were truncated",
      content: warningContent,
    });
  }

  return contextItems;
};
