import { ToolImpl } from ".";
import { resolveRelativePathInDir } from "../../util/ideUtils";

export const editFileImpl: ToolImpl = async (args, extras) => {
  const firstUriMatch = await resolveRelativePathInDir(
    args.filepath,
    extras.ide,
  );
  if (!firstUriMatch) {
    throw new Error(`File ${args.filepath} does not exist.`);
  }
  if (!extras.applyToFile) {
    throw new Error("Failed to apply to file: invalid apply stream id");
  }
  await extras.applyToFile(firstUriMatch, args.new_contents);
  return [
    {
      name: "Edit results",
      description: `Edited ${args.filepath}`,
      content: `Applied edit diffs to ${args.filepath}. The user must manually reject/accept diffs. Prompt them to do so in your response`,
    },
  ];
};
