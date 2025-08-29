import { BuiltInToolNames } from "core/tools/builtIn";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { validateAndEnhanceMultiEditArgs } from "../../util/clientTools/multiEditImpl";
import { validateAndEnhanceSingleEditArgs } from "../../util/clientTools/singleFindAndReplaceImpl";

/*
  This is the current extension equivalent of the CLI's preprocessing step
*/
export async function validateAndEnhanceToolCallArgs(
  ideMessenger: IIdeMessenger,
  toolName: string | undefined,
  currentArgs: undefined | Record<string, any>,
) {
  const argsCopy = { ...currentArgs };
  switch (toolName) {
    case BuiltInToolNames.SingleFindAndReplace:
      return await validateAndEnhanceSingleEditArgs(argsCopy, ideMessenger);
    case BuiltInToolNames.MultiEdit:
      return await validateAndEnhanceMultiEditArgs(argsCopy, ideMessenger);
  }
}
