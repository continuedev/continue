import { ToolCallState } from "core";
import { ContinueErrorReason } from "core/util/errors";
import {
  isTruncatedJson,
  truncatedToolCallResult,
} from "core/util/truncatedJson";

import { IIdeMessenger } from "../../context/IdeMessenger";
import {
  clearToolCallArguments,
  errorToolCall,
  setProcessedToolCallArgs,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { AppThunkDispatch } from "../store";

/**
 * A call the model was still writing when it hit its output limit is not run.
 * The lenient parser would turn its arguments into a valid-looking object, so
 * create_new_file would write part of the file and report success.
 */
export function refuseTruncatedToolCalls(
  dispatch: AppThunkDispatch,
  generatedToolCalls: ToolCallState[],
  maxTokens: number | undefined,
): void {
  for (const { toolCall, toolCallId } of generatedToolCalls) {
    if (!isTruncatedJson(toolCall.function.arguments ?? "")) continue;
    dispatch(errorToolCall({ toolCallId }));
    dispatch(clearToolCallArguments({ toolCallId }));
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: [
          {
            icon: "problems",
            name: "Cut off",
            description: "Hit the output limit; not run",
            content: truncatedToolCallResult(toolCall.function.name, maxTokens),
            hidden: false,
          },
        ],
      }),
    );
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
      let errorReason: ContinueErrorReason | undefined = undefined;
      let errorMessage: string | undefined = undefined;
      let preprocessedArgs: Record<string, unknown> | undefined = undefined;
      const result = await ideMessenger.request("tools/preprocessArgs", {
        toolName: tcState.toolCall.function.name,
        args: tcState.parsedArgs,
      });
      if (result.status === "success") {
        preprocessedArgs = result.content.preprocessedArgs;
        errorMessage = result.content.errorMessage;
        errorReason = result.content.errorReason;
      } else {
        errorMessage = result.error;
        errorReason = ContinueErrorReason.Unknown;
      }
      if (errorReason) {
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
      } else if (preprocessedArgs) {
        dispatch(
          setProcessedToolCallArgs({
            toolCallId: tcState.toolCallId,
            newArgs: preprocessedArgs,
          }),
        );
      }
    }),
  );
}
