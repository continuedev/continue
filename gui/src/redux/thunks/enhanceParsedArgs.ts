import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { validateAndEnhanceMultiEditArgs } from "../../util/clientTools/multiEditImpl";
import { validateAndEnhanceSingleEditArgs } from "../../util/clientTools/singleFindAndReplaceImpl";
import {
  errorToolCall,
  setToolCallArgs,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { AppThunkDispatch } from "../store";

/*
  This is the current extension equivalent of the CLI's preprocessing step
  Prior to even checking the tool policy, validate that provided args are valid and add additional args for some tools
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

export async function preprocessToolCalls(
  dispatch: AppThunkDispatch,
  ideMessenger: IIdeMessenger,
  generatedToolCalls: ToolCallState[],
): Promise<void> {
  // Tool call pre-processing
  await Promise.all(
    generatedToolCalls.map(async (tcState) => {
      try {
        const changedArgs = await validateAndEnhanceToolCallArgs(
          ideMessenger,
          tcState?.toolCall.function.name,
          tcState.parsedArgs,
        );
        if (changedArgs) {
          dispatch(
            setToolCallArgs({
              toolCallId: tcState.toolCallId,
              newArgs: changedArgs,
            }),
          );
        }
      } catch (e) {
        let errorMessage = e instanceof Error ? e.message : `Unknown error`;
        dispatch(
          errorToolCall({
            toolCallId: tcState.toolCallId,
          }),
        );
        dispatch(
          updateToolCallOutput({
            toolCallId: tcState.toolCallId,
            contextItems: [
              {
                icon: "problems",
                name: "Invalid Tool Call",
                description: "",
                content: `${tcState.toolCall.function.name} failed because the arguments were invalid, with the following message: ${errorMessage}\n\nPlease try something else or request further instructions.`,
                hidden: false,
              },
            ],
          }),
        );
      }
    }),
  );
}
