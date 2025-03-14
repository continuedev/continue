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
  // const content = await extras.ide.readFile(firstUriMatch);
  return [
    {
      name: EDIT_TOOL_CONTEXT_ITEM_NAME, // getUriPathBasename(args.filepath),
      description: "Instructions for editing the file", //args.filepath,
      content:
        "Edit Instructions: return the full new file contents in a codeblock. The codeblock header should be of the format '```language filepath'",
      // uri: {
      //   type: "file",
      //   value: firstUriMatch,
      // },
    },
  ];
};
