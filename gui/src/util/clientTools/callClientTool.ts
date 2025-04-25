import { ContextItem, ToolCall } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { AppThunkDispatch, RootState } from "../../redux/store";
import { editToolImpl } from "./editImpl";

export interface ClientToolExtras {
  getState: () => RootState;
  dispatch: AppThunkDispatch;
  ideMessenger: IIdeMessenger;
  streamId?: string;
}

export interface ClientToolOutput {
  output: ContextItem[] | undefined;
  respondImmediately: boolean;
}

export interface ClientToolResult extends ClientToolOutput {
  errorMessage: string | undefined;
}

export type ClientToolImpl = (
  args: any,
  toolCallId: string,
  extras: ClientToolExtras,
) => Promise<ClientToolOutput>;

export async function callClientTool(
  toolCall: ToolCall,
  extras: ClientToolExtras,
): Promise<ClientToolResult> {
  const args = JSON.parse(toolCall.function.arguments || "{}");
  try {
    let output: ClientToolOutput;
    switch (toolCall.function.name) {
      case BuiltInToolNames.EditExistingFile:
        output = await editToolImpl(args, toolCall.id, extras);
        break;
      default:
        throw new Error(`Invalid client tool name ${toolCall.function.name}`);
    }
    return {
      ...output,
      errorMessage: undefined,
    };
  } catch (e) {
    let errorMessage = `${e}`;
    if (e instanceof Error) {
      errorMessage = e.message;
    }
    return {
      respondImmediately: true,
      errorMessage,
      output: undefined,
    };
  }
}
