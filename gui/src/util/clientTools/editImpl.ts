import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { updateApplyState } from "../../redux/slices/sessionSlice";
import { handleEditToolApplyError } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";
export const editToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  if (!args.filepath || !args.changes) {
    throw new Error(
      "`filepath` and `changes` arguments are required to edit an existing file.",
    );
  }
  const firstUriMatch = await resolveRelativePathInDir(
    args.filepath,
    extras.ideMessenger.ide,
  );
  if (!firstUriMatch) {
    throw new Error(`${args.filepath} does not exist`);
  }
  const streamId = uuid();
  extras.dispatch(
    updateApplyState({
      streamId,
      toolCallId,
      status: "not-started",
    }),
  );
  void extras.ideMessenger
    .request("applyToFile", {
      streamId,
      text: args.changes,
      toolCallId,
      filepath: firstUriMatch,
    })
    .catch(() => {
      void extras.dispatch(
        handleEditToolApplyError({
          toolCallId,
        }),
      );
    });
  return {
    respondImmediately: false,
    output: undefined, // No immediate output.
  };
};
