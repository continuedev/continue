import { ToolPolicy } from "@continuedev/terminal-security";
import { ChatHistoryItem, Tool, ToolCallState } from "core";
import type { AutoReviewReply } from "core/tools/permissions/auto/handler";
import type { ReviewHistory } from "core/tools/permissions/auto/prompt";
import type { DecisionSource } from "core/tools/permissions/decide";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { isEditTool } from "../../util/toolCallState";
import {
  errorToolCall,
  setToolCallPolicyNote,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { DEFAULT_TOOL_SETTING, ToolPolicies } from "../slices/uiSlice";
import { AppThunkDispatch } from "../store";

/** Set when Auto mode is on and usable (see selectAutoApproval). */
export interface AutoReviewContext {
  sessionId: string;
  history: ReviewHistory;
}

interface EvaluatedPolicy {
  policy: ToolPolicy;
  displayValue?: string;
  /** Why core decided, when the user has toolPermissions rules. "auto" means the reviewer model. */
  source?: DecisionSource | "auto";
  /** The reviewer's named reason (Auto mode). */
  category?: string;
  reason?: string;
  rule?: string;
  toolCallState: ToolCallState;
}

/**
 * Evaluates the tool policy for a tool call, including dynamic policy evaluation
 * Note that tool group policies are not considered here because activeTools already excludes disabled groups
 */
async function evaluateToolPolicy(
  ideMessenger: IIdeMessenger,
  activeTools: Tool[],
  toolCallState: ToolCallState,
  toolPolicies: ToolPolicies,
): Promise<EvaluatedPolicy> {
  const toolName = toolCallState.toolCall.function.name;

  // Edit tools are reviewed as a diff the user accepts or rejects, so they
  // are not asked about up front. They still go through core so a deny rule
  // (for example writeFile(.github/**)) can refuse them, and so an edit to a
  // protected file (a workflow, a git hook, .env) is held for approval instead
  // of being applied as soon as the diff is ready. An ordinary ask or allow
  // rule changes nothing here: the diff review already is the ask.
  if (isEditTool(toolName)) {
    try {
      const result = await ideMessenger.request("tools/evaluatePolicy", {
        toolName,
        basePolicy: "allowedWithoutPermission",
        parsedArgs: toolCallState.parsedArgs,
        processedArgs: toolCallState.processedArgs,
      });
      if (result.status === "success") {
        const { policy, source } = result.content;
        if (policy === "disabled") {
          return { ...result.content, toolCallState };
        }
        if (source === "protected-path") {
          return { ...result.content, toolCallState };
        }
      }
    } catch (e) {
      // Edits never depended on core before, so an unreachable core must not
      // stop them now. The diff review is still the user's check.
      console.error(`Could not check rules for ${toolName}`, e);
    }
    return { policy: "allowedWithoutPermission", toolCallState };
  }

  const basePolicy =
    toolPolicies[toolName] ??
    activeTools.find((tool) => tool.function.name === toolName)
      ?.defaultToolPolicy ??
    DEFAULT_TOOL_SETTING;

  const result = await ideMessenger.request("tools/evaluatePolicy", {
    toolName,
    basePolicy,
    parsedArgs: toolCallState.parsedArgs,
    processedArgs: toolCallState.processedArgs,
  });

  // Evaluate the policy dynamically
  if (result.status === "error") {
    console.error(`Error evaluating tool policy for ${toolName}`, result.error);
    return { policy: "disabled", toolCallState };
  }

  const { policy: dynamicPolicy, ...details } = result.content;

  // Ensure dynamic policy cannot be more lenient than base policy
  // Policy hierarchy (most restrictive to least): disabled > allowedWithPermission > allowedWithoutPermission
  if (basePolicy === "disabled") {
    return { ...details, policy: "disabled", toolCallState }; // Cannot override disabled
  }
  if (
    basePolicy === "allowedWithPermission" &&
    dynamicPolicy === "allowedWithoutPermission" &&
    // The one exception: the user's own allow rule, which core has already
    // checked cannot loosen a disabled tool or a refused command.
    details.source !== "allow-rule"
  ) {
    return { ...details, policy: "allowedWithPermission", toolCallState }; // Cannot make more lenient
  }

  return { ...details, policy: dynamicPolicy, toolCallState };
}

/**
 * What the reviewer is shown of the conversation: the user's own messages and
 * the earlier tool calls (name and arguments), never the agent's prose or any
 * tool output.
 */
export function buildReviewHistory(history: ChatHistoryItem[]): ReviewHistory {
  const userMessages: string[] = [];
  const toolCalls: ReviewHistory["toolCalls"] = [];
  for (const item of history) {
    const { message } = item;
    if (message.role === "user") {
      const text =
        typeof message.content === "string"
          ? message.content
          : message.content
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
      if (text.trim()) userMessages.push(text);
    }
    for (const call of item.toolCallStates ?? []) {
      toolCalls.push({
        name: call.toolCall.function.name,
        args: call.parsedArgs,
      });
    }
  }
  return { userMessages, toolCalls };
}

/**
 * Auto mode: ask core's reviewer about calls that wait for approval. Core runs
 * the rules again first, so a deny rule, protected path or ask rule comes back
 * unchanged and the model is never asked. The reviewer can allow a call, leave
 * it for the user, or refuse it; anything that goes wrong leaves it for the user.
 */
async function reviewOpenCalls(
  ideMessenger: IIdeMessenger,
  results: EvaluatedPolicy[],
  auto: AutoReviewContext,
  toolPolicies: ToolPolicies,
  activeTools: Tool[],
): Promise<EvaluatedPolicy[]> {
  return Promise.all(
    results.map(async (r) => {
      const toolName = r.toolCallState.toolCall.function.name;
      const open =
        r.policy === "allowedWithPermission" &&
        !isEditTool(toolName) &&
        r.source !== "ask-rule" &&
        r.source !== "protected-path";
      if (!open) return r;

      const basePolicy =
        toolPolicies[toolName] ??
        activeTools.find((t) => t.function.name === toolName)
          ?.defaultToolPolicy ??
        DEFAULT_TOOL_SETTING;
      let reply: AutoReviewReply;
      try {
        const res = await ideMessenger.request("tools/autoReview", {
          sessionId: auto.sessionId,
          toolName,
          basePolicy,
          parsedArgs: r.toolCallState.parsedArgs,
          processedArgs: r.toolCallState.processedArgs,
          history: auto.history,
        });
        if (res.status !== "success") return r;
        reply = res.content;
      } catch (e) {
        console.error(`Auto review failed for ${toolName}`, e);
        return r;
      }

      // The reviewer only ever acts on a call that was waiting for the user.
      if (reply.by === "rules") return r;
      switch (reply.decision) {
        case "allow":
          return {
            ...r,
            policy: "allowedWithoutPermission" as const,
            source: "auto" as const,
            reason: `Allowed by Auto: ${reply.reason}`,
          };
        case "deny":
          return {
            ...r,
            policy: "disabled" as const,
            source: "auto" as const,
            category: reply.category,
            reason: reply.reason,
          };
        default:
          return {
            ...r,
            source: "auto" as const,
            category: reply.category,
            reason: `Auto: ${reply.reason}${reply.category ? ` [${reply.category}]` : ""}`,
          };
      }
    }),
  );
}

/** The text the model sees when a call is refused, naming who refused it. */
export function refusalMessage(
  command: string,
  source: DecisionSource | "auto" | undefined,
  reason: string | undefined,
  category?: string,
): { description: string; content: string } {
  switch (source) {
    case "auto":
      return {
        description: `Blocked by Auto${category ? ` [${category}]` : ""}`,
        content: `A reviewer model refused this call${category ? ` (${category})` : ""}: ${reason ?? "no reason given"}\n\n${command}\n\nDo not retry it or reach the same result another way. Find a safer route to the user's request, or tell the user what you need and ask how they want to proceed.`,
      };
    case "deny-rule":
      return {
        description: "Blocked by your rule",
        content: `${reason ?? "Blocked by a rule in the user's config.yaml."}\n\n${command}\n\nDo not retry this or reach the same result another way. Tell the user what you were trying to do and ask how they want to proceed.`,
      };
    case "tool-setting":
      return {
        description: "Tool turned off",
        content: `${reason ?? "This tool is turned off in the user's tool settings."}\n\n${command}\n\nDo not try to work around this. Tell the user what you needed and ask how they want to proceed.`,
      };
    default:
      return {
        description: "Command Disabled",
        content: `This command has been disabled by security policy:\n\n${command}\n\nThis command cannot be executed as it may pose a security risk.`,
      };
  }
}

/*
    1. Get arg-dependent tool policies from core
    2. Mark any disabled ones as errored
    3. Mark others as generated
*/
export async function evaluateToolPolicies(
  dispatch: AppThunkDispatch,
  ideMessenger: IIdeMessenger,
  activeTools: Tool[],
  generatedToolCalls: ToolCallState[],
  toolPolicies: ToolPolicies,
  auto?: AutoReviewContext,
): Promise<EvaluatedPolicy[]> {
  // Check if ALL tool calls are auto-approved using dynamic evaluation
  let policyResults = await Promise.all(
    generatedToolCalls.map((toolCallState) =>
      evaluateToolPolicy(
        ideMessenger,
        activeTools,
        toolCallState,
        toolPolicies,
      ),
    ),
  );
  if (auto) {
    policyResults = await reviewOpenCalls(
      ideMessenger,
      policyResults,
      auto,
      toolPolicies,
      activeTools,
    );
  }

  const disabledResults = policyResults.filter(
    ({ policy }) => policy === "disabled",
  );

  // Say why a call is waiting, when a rule or protected path made it wait, so
  // the prompt is not a mystery for a tool the user set to run on its own.
  for (const { policy, source, reason, toolCallState } of policyResults) {
    if (
      policy === "allowedWithPermission" &&
      reason &&
      (source === "protected-path" ||
        source === "ask-rule" ||
        source === "auto")
    ) {
      dispatch(
        setToolCallPolicyNote({
          toolCallId: toolCallState.toolCallId,
          note: reason,
        }),
      );
    }
  }

  for (const {
    displayValue,
    source,
    reason,
    category,
    toolCallState,
  } of disabledResults) {
    dispatch(errorToolCall({ toolCallId: toolCallState.toolCallId }));

    // Use the displayValue from the policy evaluation, or fallback to function name
    const command = displayValue || toolCallState.toolCall.function.name;
    const { description, content } = refusalMessage(
      command,
      source,
      reason,
      category,
    );

    // Add error message explaining why it's disabled
    dispatch(
      updateToolCallOutput({
        toolCallId: toolCallState.toolCallId,
        contextItems: [
          {
            icon: "problems",
            name: "Security Policy Violation",
            description,
            content,
            hidden: false,
          },
        ],
      }),
    );
  }

  return policyResults;
}
