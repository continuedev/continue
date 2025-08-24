import { BuiltInToolNames } from "core/tools/builtIn";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { getUriPathBasename } from "core/util/uri";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { setToolCallArgs } from "../slices/sessionSlice";
import { AppThunkDispatch } from "../store";

export async function enhanceParsedArgs(
  ideMessenger: IIdeMessenger,
  dispatch: AppThunkDispatch,
  toolName: string | undefined,
  toolCallId: string,
  currentArgs: undefined | Record<string, any>,
) {
  // Add file content to parsedArgs for find/replace tools
  let enhancedArgs = { ...currentArgs };
  if (
    (toolName === BuiltInToolNames.SingleFindAndReplace ||
      toolName === BuiltInToolNames.MultiEdit ||
      toolName === BuiltInToolNames.SearchAndReplaceInFile) &&
    currentArgs?.filepath &&
    !currentArgs?.editingFileContents
  ) {
    try {
      const fileUri = await resolveRelativePathInDir(
        currentArgs.filepath,
        ideMessenger.ide,
      );
      if (!fileUri) {
        throw new Error(`File ${currentArgs.filepath} not found`);
      }
      const baseName = getUriPathBasename(fileUri);
      const fileContent = await ideMessenger.ide.readFile(fileUri);
      enhancedArgs = {
        ...currentArgs,
        fileUri,
        baseName,
        editingFileContents: fileContent,
      };
      dispatch(
        setToolCallArgs({
          toolCallId,
          newArgs: enhancedArgs,
        }),
      );
    } catch (error) {
      // If we can't read the file, let the tool handle the error
      console.warn(
        `Failed to enhance args: failed to read file ${currentArgs?.filepath}`,
      );
    }
  }
}
