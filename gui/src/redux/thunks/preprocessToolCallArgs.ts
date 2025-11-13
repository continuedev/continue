import { ToolCallState } from "core";
import { ContinueErrorReason } from "core/util/errors";
import posthog from "posthog-js";
import { IIdeMessenger } from "../../context/IdeMessenger";
import {
  errorToolCall,
  setProcessedToolCallArgs,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { AppThunkDispatch } from "../store";

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
        posthog.capture("tool_call_outcome", {
          // model: , TODO
          succeeded: false,
          toolName: tcState.toolCall.function.name,
          errorReason,
          duration_ms: 0, // preprocessing is more or less instantaneous
        });
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
