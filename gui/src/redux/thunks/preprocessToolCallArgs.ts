import { ToolCallState } from "core";
import { IIdeMessenger } from "../../context/IdeMessenger";
import {
  errorToolCall,
  setToolCallArgs,
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
      try {
        const result = await ideMessenger.request("tools/preprocessArgs", {
          toolName: tcState.toolCall.function.name,
          args: tcState.parsedArgs,
        });
        if (result.status === "success") {
          if (result.content.preprocessedArgs) {
            dispatch(
              setToolCallArgs({
                toolCallId: tcState.toolCallId,
                newArgs: result.content.preprocessedArgs,
              }),
            );
          }
        } else {
          throw new Error(result.error);
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
