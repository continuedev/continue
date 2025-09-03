import { Tool, ToolCallState, ToolPolicy } from "core";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import {
  errorToolCall,
  setToolGenerated,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { DEFAULT_TOOL_SETTING, ToolPolicies } from "../slices/uiSlice";
import { AppThunkDispatch, RootState } from "../store";

interface EvaluatedPolicy {
  policy: ToolPolicy;
  displayValue?: string;
  toolCallState: ToolCallState;
}

/**
 * Evaluates the tool policy for a tool call, including dynamic policy evaluation
 */
async function evaluateToolPolicy(
  toolCallState: ToolCallState,
  toolSettings: Record<string, ToolPolicy>,
  activeTools: Tool[],
  ideMessenger: IIdeMessenger,
): Promise<EvaluatedPolicy> {
  const basePolicy =
    toolSettings[toolCallState.toolCall.function.name] ??
    activeTools.find(
      (tool) => tool.function.name === toolCallState.toolCall.function.name,
    )?.defaultToolPolicy ??
    DEFAULT_TOOL_SETTING;

  // Use already parsed arguments
  const parsedArgs = toolCallState.parsedArgs || {};

  let result;
  try {
    result = await ideMessenger.request("tools/evaluatePolicy", {
      toolName: toolCallState.toolCall.function.name,
      basePolicy,
      args: parsedArgs,
    });
  } catch (error) {
    // If request fails, return disabled
    return { policy: "disabled", toolCallState };
  }

  // Evaluate the policy dynamically
  if (!result || result.status === "error") {
    // If evaluation fails, treat as disabled
    return { policy: "disabled", toolCallState };
  }

  const dynamicPolicy = result.content.policy;
  const displayValue = result.content.displayValue;

  // Ensure dynamic policy cannot be more lenient than base policy
  // Policy hierarchy (most restrictive to least): disabled > allowedWithPermission > allowedWithoutPermission
  if (basePolicy === "disabled") {
    return { policy: "disabled", displayValue, toolCallState }; // Cannot override disabled
  }
  if (
    basePolicy === "allowedWithPermission" &&
    dynamicPolicy === "allowedWithoutPermission"
  ) {
    return { policy: "allowedWithPermission", displayValue, toolCallState }; // Cannot make more lenient
  }

  return { policy: dynamicPolicy, displayValue, toolCallState };
}

/*
    1. Get arg-dependent tool policies from core
    2. Mark any disabled ones as errored
    3. Mark others as generated
*/
export async function evaluateToolPolicies(
  dispatch: AppThunkDispatch,
  generatingToolCalls: 
  ideMessenger: IIdeMessenger,
  activeTools: Tool[],
  toolPolicies: ToolPolicies
): Promise<EvaluatedPolicy[]> {
  const toolSettings = state.ui.toolSettings;
  const toolCallStates = selectCurrentToolCalls(state);
  const generatingCalls = toolCallStates.filter(
    ({ status }) => status === "generating",
  );

  // Check if ALL tool calls are auto-approved using dynamic evaluation
  const policyResults = await Promise.all(
    generatingCalls.map((toolCallState) =>
      evaluateToolPolicy(
        toolCallState,
        toolSettings,
        activeTools,
        ideMessenger,
      ),
    ),
  );

  for (const { displayValue, toolCallState, policy } of policyResults) {
    if (policy === "disabled") {
      dispatch(errorToolCall({ toolCallId: toolCallState.toolCallId }));

      // Use the displayValue from the policy evaluation, or fallback to function name
      const command = displayValue || toolCallState.toolCall.function.name;

      // Add error message explaining why it's disabled
      dispatch(
        updateToolCallOutput({
          toolCallId: toolCallState.toolCallId,
          contextItems: [
            {
              icon: "problems",
              name: "Security Policy Violation",
              description: "Command Disabled",
              content: `This command has been disabled by security policy:\n\n${command}\n\nThis command cannot be executed as it may pose a security risk.`,
              hidden: false,
            },
          ],
        }),
      );
    } else {
    
    }
  }

  return policyResults;
}
