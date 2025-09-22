import { ContextItem, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { ContinueError, ContinueErrorReason } from "core/util/errors";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { AppThunkDispatch, RootState } from "../../redux/store";
import { editToolImpl } from "./editImpl";
import { multiEditImpl } from "./multiEditImpl";
import { singleFindAndReplaceImpl } from "./singleFindAndReplaceImpl";

export interface ClientToolExtras {
  getState: () => RootState;
  dispatch: AppThunkDispatch;
  ideMessenger: IIdeMessenger;
}

export interface ClientToolOutput {
  output: ContextItem[] | undefined;
  respondImmediately: boolean;
}

export interface ClientToolResult extends ClientToolOutput {
  error?: ContinueError;
}

export type ClientToolImpl = (
  args: any,
  toolCallId: string,
  extras: ClientToolExtras,
) => Promise<ClientToolOutput>;

export async function callClientTool(
  toolCallState: ToolCallState,
  extras: ClientToolExtras,
): Promise<ClientToolResult> {
  const { toolCall, parsedArgs } = toolCallState;
  try {
    let output: ClientToolOutput;
    switch (toolCall.function.name) {
      case BuiltInToolNames.EditExistingFile:
        output = await editToolImpl(parsedArgs, toolCall.id, extras);
        break;
      case BuiltInToolNames.SingleFindAndReplace:
        output = await singleFindAndReplaceImpl(
          parsedArgs,
          toolCall.id,
          extras,
        );
        break;
      case BuiltInToolNames.MultiEdit:
        output = await multiEditImpl(parsedArgs, toolCall.id, extras);
        break;
      default:
        throw new Error(`Invalid client tool name ${toolCall.function.name}`);
    }
    return output;
  } catch (e) {
    return {
      respondImmediately: true,
      error:
        e instanceof ContinueError
          ? e
          : e instanceof Error
            ? new ContinueError(ContinueErrorReason.Unspecified, e.message)
            : new ContinueError(ContinueErrorReason.Unknown, String(e)),
      output: undefined,
    };
  }
}
