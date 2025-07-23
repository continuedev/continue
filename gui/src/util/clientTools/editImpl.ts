import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { ClientToolImpl } from "./callClientTool";
export const editToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const firstUriMatch = await resolveRelativePathInDir(
    args.filepath,
    extras.ideMessenger.ide,
  );
  if (!firstUriMatch) {
    throw new Error(`${args.filepath} does not exist`);
  }
  const streamId = uuid();
  extras.ideMessenger.post("applyToFile", {
    streamId,
    text: args.changes,
    toolCallId,
    filepath: firstUriMatch,
  });

  return {
    respondImmediately: false,
    output: undefined, // No immediate output.
  };
};
