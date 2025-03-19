import { ToolImpl } from ".";
import { resolveRelativePathInDir } from "../../util/ideUtils";

export const EDIT_TOOL_CONTEXT_ITEM_NAME = "Edit Tool Instructions";

export const editFileImpl: ToolImpl = async (args, extras) => {
  const firstUriMatch = await resolveRelativePathInDir(
    args.filepath,
    extras.ide,
  );
  if (!firstUriMatch) {
    throw new Error(`File ${args.filepath} does not exist.`);
  }
  return [
    {
      name: EDIT_TOOL_CONTEXT_ITEM_NAME,
      description: "Instructions for editing the file",
      content:
        "Edit Instructions: return the full new file contents in a codeblock. The codeblock header should be of the format '```language filepath'",
    },
  ];
};
