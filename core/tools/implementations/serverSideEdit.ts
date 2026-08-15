import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getCleanUriPath, getUriPathBasename } from "../../util/uri";
import { BuiltInToolNames } from "../builtIn";
import { ToolImpl } from ".";

/**
 * Server-side execution for edit tools whose file-content computation is
 * already deterministic and core-side via `tool.preprocessArgs` (see
 * core/tools/definitions/singleFindAndReplace.ts and multiEdit.ts - both
 * call into core/edit/searchAndReplace/*, which is the same logic the GUI's
 * client-side edit implementations rely on for computing the new contents).
 *
 * Normal chat sessions run these through the GUI instead
 * (gui/src/util/clientTools/*), which streams the diff live into an open
 * editor tab for interactive review before writing. This server-side path
 * skips that live-preview UX and writes the file directly - used when there
 * is no interactive editor session driving the call, e.g. tool calls coming
 * from shadow-code-tools MCP (see core/mcp/shadowCodeToolsServer.ts).
 */
async function applyPreprocessedEdit(
  toolName: string,
  args: any,
  extras: Parameters<ToolImpl>[1],
) {
  if (!extras.tool.preprocessArgs) {
    throw new ContinueError(
      ContinueErrorReason.Unknown,
      `${toolName} has no preprocessArgs implementation to compute the edit`,
    );
  }
  const processed = await extras.tool.preprocessArgs(args, {
    ide: extras.ide,
  });
  const fileUri = processed.fileUri as string;
  const newFileContents = processed.newFileContents as string;

  await extras.ide.writeFile(fileUri, newFileContents);
  await extras.ide.saveFile(fileUri);
  if (extras.codeBaseIndexer) {
    void extras.codeBaseIndexer.refreshCodebaseIndexFiles([fileUri]);
  }

  return [
    {
      name: getUriPathBasename(fileUri),
      description: getCleanUriPath(fileUri),
      content: `Applied ${toolName} to ${getCleanUriPath(fileUri)}`,
      uri: { type: "file" as const, value: fileUri },
    },
  ];
}

export const singleFindAndReplaceServerImpl: ToolImpl = async (args, extras) =>
  applyPreprocessedEdit(BuiltInToolNames.SingleFindAndReplace, args, extras);

export const multiEditServerImpl: ToolImpl = async (args, extras) =>
  applyPreprocessedEdit(BuiltInToolNames.MultiEdit, args, extras);

// edit_existing_file's `changes` argument is a freeform "sketch" of the
// edit (e.g. "// ... existing code ..." placeholders) with no deterministic,
// core-side reconciliation available anywhere in this codebase today -
// applying it correctly is normally done by the GUI's live diff-preview
// flow (gui/src/util/clientTools/editImpl.ts), which has no equivalent
// here. Rather than guess at a fuzzy-patch algorithm and risk corrupting
// files, this tells the model to use single_find_and_replace/multi_edit
// instead, which are always offered alongside edit_existing_file (see
// core/tools/index.ts:getConfigDependentToolDefinitions) and cover the same
// need with exact-match semantics that are safe to apply server-side.
export const editExistingFileUnsupportedImpl: ToolImpl = async () => {
  throw new ContinueError(
    ContinueErrorReason.Unknown,
    "edit_existing_file is not available in this session. Use single_find_and_replace " +
      "(or multi_edit for several changes to one file) instead - read the file first " +
      "if you don't already know its exact current contents.",
  );
};
