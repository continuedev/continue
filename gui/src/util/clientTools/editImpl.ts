import { resolveRelativePathInDir } from "core/util/ideUtils";
import { ClientToolImpl } from "./callClientTool";

export const editToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
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
  const apply = await extras.ideMessenger.request("applyToFile", {
    streamId: extras.streamId,
    text: args.changes,
    toolCallId,
    filepath: firstUriMatch,
  });
  if (apply.status === "error") {
    throw new Error(apply.error);
  }

  return {
    respondImmediately: false,
    output: undefined, // No immediate output.
  };
};
