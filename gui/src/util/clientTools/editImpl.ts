import { resolveRelativePathInDir } from "core/util/ideUtils";
import { updateApplyState } from "../../redux/slices/sessionSlice";
import { ClientToolImpl } from "./callClientTool";

export const editToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  if (!extras.activeToolStreamId) {
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
    streamId: extras.activeToolStreamId,
    text: args.new_contents,
    toolCallId,
    filepath: firstUriMatch,
  });
  if (apply.status === "error") {
    throw new Error(apply.error);
  }
  if (extras.activeToolStreamId) {
    extras.dispatch(
      updateApplyState({
        streamId: extras.activeToolStreamId,
        status: "closed",
        toolCallId,
        numDiffs: 0,
        filepath: args.filepath,
      }),
    );
  }
  return undefined;
};
