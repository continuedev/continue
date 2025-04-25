import { resolveRelativePathInDir } from "core/util/ideUtils";
import { updateApplyState } from "../../redux/slices/sessionSlice";
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
    text: args.new_contents,
    toolCallId,
    filepath: firstUriMatch,
  });
  if (apply.status === "error") {
    throw new Error(apply.error);
  }
  if (extras.streamId) {
    extras.dispatch(
      updateApplyState({
        streamId: extras.streamId,
        status: "done",
        toolCallId,
        numDiffs: 0,
        filepath: args.filepath,
      }),
    );
  }
  return {
    respondImmediately: false,
    output: undefined, // No immediate output.
  };
};
