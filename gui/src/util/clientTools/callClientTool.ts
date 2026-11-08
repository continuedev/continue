import { ContextItem, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { ContinueError, ContinueErrorReason } from "core/util/errors";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { AppThunkDispatch, RootState } from "../../redux/store";
import { editToolImpl } from "./editImpl";
import { multiEditImpl } from "./multiEditImpl";
import { runSubagentTool } from "../subagents/runSubagent";
import { finishItemImpl, holdQuestionImpl } from "./loopToolsImpl";
import { presentPlanImpl } from "./presentPlanImpl";
import { singleFindAndReplaceImpl } from "./singleFindAndReplaceImpl";
import { taskListImpl } from "./taskListImpl";

export interface ClientToolExtras {
  getState: () => RootState;
  dispatch: AppThunkDispatch;
  ideMessenger: IIdeMessenger;
}

export interface ClientToolOutput {
  output: ContextItem[] | undefined;
  respondImmediately: boolean;
  /**
   * With respondImmediately: record the result and end the turn instead of
   * sending it to the model (present_plan waits for the person's Build).
   */
  endTurn?: boolean;
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
      case BuiltInToolNames.Subagent:
        output = await runSubagentTool(parsedArgs, toolCall.id, extras);
        break;
      case BuiltInToolNames.TaskList:
        output = await taskListImpl(parsedArgs, toolCall.id, extras);
        break;
      case BuiltInToolNames.PresentPlan:
        output = await presentPlanImpl(parsedArgs, toolCall.id, extras);
        break;
      case BuiltInToolNames.HoldQuestion:
        output = await holdQuestionImpl(parsedArgs, toolCall.id, extras);
        break;
      case BuiltInToolNames.FinishItem:
        output = await finishItemImpl(parsedArgs, toolCall.id, extras);
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
