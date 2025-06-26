import { resolveRelativePathInDir } from "core/util/ideUtils";
import { ClientToolImpl } from "./callClientTool";

export const editToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  console.log("EDIT TOOL IMPL", args, toolCallId, extras);
  if (!extras.streamId) {
    throw new Error("Invalid apply state");
  }
  const firstUriMatch = await resolveRelativePathInDir(
    args.filepath,
    extras.ideMessenger.ide,
  );
  if (!firstUriMatch) {
    throw new Error(`${args.filepath} does not exist`);
  }
  extras.ideMessenger.post("applyToFile", {
    streamId: extras.streamId,
    text: args.changes,
    toolCallId,
    filepath: firstUriMatch,
  });

  return {
    respondImmediately: false,
    output: undefined, // No immediate output.
  };
};
