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
  const state = extras.getState();
  const autoAccept = !!state.config.config.ui?.autoAcceptEditToolDiffs;
  if (autoAccept) {
    const out = await extras.ideMessenger.request("acceptDiff", {
      streamId: extras.streamId,
      filepath: firstUriMatch,
    });
    if (out.status === "error") {
      throw new Error(out.error);
    }
    return {
      respondImmediately: true,
      output: undefined, // TODO - feed edit results back to model (also in parallel listeners)
    };
  }
  return {
    respondImmediately: false,
    output: undefined, // No immediate output.
  };
};
