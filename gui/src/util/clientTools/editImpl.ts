import { resolveRelativePathInDir } from "core/util/ideUtils";
import { isLazyText } from "core/edit/lazy/deterministic";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
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
  let filepath = args.filepath;
  if (filepath.startsWith("./")) {
    filepath = filepath.slice(2);
  }

  let firstUriMatch = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );

  if (!firstUriMatch) {
    const openFiles = await extras.ideMessenger.ide.getOpenFiles();
    for (const uri of openFiles) {
      if (uri.endsWith(filepath)) {
        firstUriMatch = uri;
        break;
      }
    }
  }

  if (!firstUriMatch) {
    throw new Error(`${filepath} does not exist`);
  }

  const existingContent = await extras.ideMessenger.ide.readFile(firstUriMatch);
  const existingLines = existingContent.split("\n");
  const changesLines = args.changes.split("\n");

  if (!isLazyText(args.changes) && existingLines.length > 10 && changesLines.length < existingLines.length * 0.5) {
    throw new Error(
      `The \`changes\` argument must contain anchor markers (e.g. "// ... existing code ...") to indicate which parts of the file to keep. Without anchors, Continue cannot safely determine which portions of the existing ${existingLines.length}-line file to preserve. Use single_find_and_replace for small targeted changes, or include proper lazy-anchor markers in the \`changes\` argument.`,
    );
  }

  const streamId = uuid();
  void extras.dispatch(
    applyForEditTool({
      streamId,
      text: args.changes,
      toolCallId,
      filepath: firstUriMatch,
    }),
  );

  return {
    respondImmediately: false,
    output: undefined, // no immediate output - output for edit tools should be added based on apply state coming in
  };
};
