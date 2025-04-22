import { ContextItem, ToolCall } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { AppThunkDispatch } from "../../redux/store";
import { editToolImpl } from "./editImpl";

export interface ClientToolExtras {
  dispatch: AppThunkDispatch;
  ideMessenger: IIdeMessenger;
  activeToolStreamId?: string;
}

export interface ClientToolOutput {
  output?: ContextItem[];
  errorMessage?: string;
}

export type ClientToolImpl = (
  args: any,
  toolCallId: string,
  extras: ClientToolExtras,
) => Promise<ContextItem[] | undefined>;

export async function callClientTool(
  toolCall: ToolCall,
  extras: ClientToolExtras,
): Promise<ClientToolOutput> {
  const args = JSON.parse(toolCall.function.arguments || "{}");
  let output: ContextItem[] | undefined = undefined;
  try {
    switch (toolCall.function.name) {
      case BuiltInToolNames.EditExistingFile:
        output = await editToolImpl(args, toolCall.id, extras);
      default:
        throw new Error(`Invalid client tool name ${toolCall.function.name}`);
    }
    return { output };
  } catch (e) {
    let errorMessage = `Failed to call ${toolCall.function.name} tool`;
    if (e instanceof Error) {
      errorMessage = e.message;
    }
    return { errorMessage };
  }
}
