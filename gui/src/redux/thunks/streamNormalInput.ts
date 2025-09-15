import { ToolPolicy } from "@continuedev/terminal-security";
import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import {
  LLMFullCompletionOptions,
  ModelDescription,
  Tool,
  ToolCallState,
} from "core";
import { getRuleId } from "core/llm/rules/getSystemMessageWithRules";
import { ToCoreProtocol } from "core/protocol";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  errorToolCall,
  setActive,
  setAppliedRulesAtIndex,
  setContextPercentage,
  setInactive,
  setInlineErrorMessage,
  setIsPruned,
  setToolGenerated,
  streamUpdate,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { AppThunkDispatch, RootState, ThunkApiType } from "../store";
import { constructMessages } from "../util/constructMessages";

import { modelSupportsNativeTools } from "core/llm/toolSupport";
import { addSystemMessageToolsToSystemMessage } from "core/tools/systemMessageTools/buildToolsSystemMessage";
import { interceptSystemToolCalls } from "core/tools/systemMessageTools/interceptSystemToolCalls";
import { SystemMessageToolCodeblocksFramework } from "core/tools/systemMessageTools/toolCodeblocks";
import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import { DEFAULT_TOOL_SETTING } from "../slices/uiSlice";
import { getBaseSystemMessage } from "../util/getBaseSystemMessage";
import { callToolById } from "./callToolById";
import { enhanceParsedArgs } from "./enhanceParsedArgs";

/**
 * Evaluates the tool policy for a tool call, including dynamic policy evaluation
 */
async function evaluateToolPolicy(
  toolCallState: ToolCallState,
  toolSettings: Record<string, ToolPolicy>,
  activeTools: Tool[],
  ideMessenger: IIdeMessenger,
): Promise<{ policy: ToolPolicy; displayValue?: string }> {
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
    return { policy: "disabled" };
  }

  // Evaluate the policy dynamically
  if (!result || result.status === "error") {
    // If evaluation fails, treat as disabled
    return { policy: "disabled" };
  }

  const dynamicPolicy = result.content.policy;
  const displayValue = result.content.displayValue;

  // Ensure dynamic policy cannot be more lenient than base policy
  // Policy hierarchy (most restrictive to least): disabled > allowedWithPermission > allowedWithoutPermission
  if (basePolicy === "disabled") {
    return { policy: "disabled", displayValue }; // Cannot override disabled
  }
  if (
    basePolicy === "allowedWithPermission" &&
    dynamicPolicy === "allowedWithoutPermission"
  ) {
    return { policy: "allowedWithPermission", displayValue }; // Cannot make more lenient
  }

  return { policy: dynamicPolicy, displayValue };
}

/**
 * Handles the execution of tool calls that may be automatically accepted.
 * Sets all tools as generated first, then executes auto-approved tool calls.
 */
async function handleToolCallExecution(
  dispatch: AppThunkDispatch,
  getState: () => RootState,
  activeTools: Tool[],
  ideMessenger: IIdeMessenger,
): Promise<boolean> {
  // Return whether all tools were auto-approved
  const newState = getState();
  const toolSettings = newState.ui.toolSettings;
  const allToolCallStates = selectCurrentToolCalls(newState);

  // Only process tool calls that are in "generating" status (newly created during this streaming session)
  const toolCallStates = allToolCallStates.filter(
    (toolCallState) => toolCallState.status === "generating",
  );

  // If no generating tool calls, nothing to process
  if (toolCallStates.length === 0) {
    return false; // No tools to process, need to set inactive
  }

  // Check if ALL tool calls are auto-approved using dynamic evaluation
  const policyResults = await Promise.all(
    toolCallStates.map((toolCallState) =>
      evaluateToolPolicy(
        toolCallState,
        toolSettings,
        activeTools,
        ideMessenger,
      ),
    ),
  );

  // Handle disabled tool calls and set others as generated
  const autoApprovedResults = await Promise.all(
    toolCallStates.map(async (toolCallState, index) => {
      const { policy, displayValue } = policyResults[index];

      if (policy === "disabled") {
        // Mark as errored instead of generated
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
        return false;
      } else {
        // Set as generated for non-disabled tools
        dispatch(
          setToolGenerated({
            toolCallId: toolCallState.toolCallId,
            tools: newState.config.config.tools,
          }),
        );
        return policy === "allowedWithoutPermission";
      }
    }),
  );

  const allAutoApproved = autoApprovedResults.every(Boolean);

  // Only run if we have auto-approve for all non-disabled tools
  if (allAutoApproved && toolCallStates.length > 0) {
    const nonDisabledToolCalls = toolCallStates.filter(
      (_, index) => policyResults[index].policy !== "disabled",
    );

    const toolCallPromises = nonDisabledToolCalls.map(async (toolCallState) => {
      const response = await dispatch(
        callToolById({ toolCallId: toolCallState.toolCallId }),
      );
      unwrapResult(response);
    });

    await Promise.all(toolCallPromises);
  }

  return allAutoApproved;
}

/**
 * Builds completion options with reasoning configuration based on session state and model capabilities.
 *
 * @param baseOptions - Base completion options to extend
 * @param hasReasoningEnabled - Whether reasoning is enabled in the session
 * @param model - The selected model with provider and completion options
 * @returns Completion options with reasoning configuration
 */
function buildReasoningCompletionOptions(
  baseOptions: LLMFullCompletionOptions,
  hasReasoningEnabled: boolean | undefined,
  model: ModelDescription,
): LLMFullCompletionOptions {
  if (hasReasoningEnabled === undefined) {
    return baseOptions;
  }

  const reasoningOptions: LLMFullCompletionOptions = {
    ...baseOptions,
    reasoning: !!hasReasoningEnabled,
  };

  // Add reasoning budget tokens if reasoning is enabled and provider supports it
  if (hasReasoningEnabled && model.underlyingProviderName !== "ollama") {
    // Ollama doesn't support limiting reasoning tokens at this point
    reasoningOptions.reasoningBudgetTokens =
      model.completionOptions?.reasoningBudgetTokens ?? 2048;
  }

  return reasoningOptions;
}

export const streamNormalInput = createAsyncThunk<
  void,
  {
    legacySlashCommandData?: ToCoreProtocol["llm/streamChat"][0]["legacySlashCommandData"];
  },
  ThunkApiType
>(
  "chat/streamNormalInput",
  async ({ legacySlashCommandData }, { dispatch, extra, getState }) => {
    const state = getState();
    const selectedChatModel = selectSelectedChatModel(state);

    if (!selectedChatModel) {
      throw new Error("No chat model selected");
    }

    // Get tools and filter them based on the selected model
    const activeTools = selectActiveTools(state);

    // Use the centralized selector to determine if system message tools should be used
    const useNativeTools = state.config.config.experimental
      ?.onlyUseSystemMessageTools
      ? false
      : modelSupportsNativeTools(selectedChatModel);
    const systemToolsFramework = !useNativeTools
      ? new SystemMessageToolCodeblocksFramework()
      : undefined;

    // Construct completion options
    let completionOptions: LLMFullCompletionOptions = {};
    if (useNativeTools && activeTools.length > 0) {
      completionOptions = {
        tools: activeTools,
      };
    }

    completionOptions = buildReasoningCompletionOptions(
      completionOptions,
      state.session.hasReasoningEnabled,
      selectedChatModel,
    );

    // Construct messages (excluding system message)
    const baseSystemMessage = getBaseSystemMessage(
      state.session.mode,
      selectedChatModel,
      activeTools,
    );

    const systemMessage = systemToolsFramework
      ? addSystemMessageToolsToSystemMessage(
          systemToolsFramework,
          baseSystemMessage,
          activeTools,
        )
      : baseSystemMessage;

    const withoutMessageIds = state.session.history.map((item) => {
      const { id, ...messageWithoutId } = item.message;
      return { ...item, message: messageWithoutId };
    });

    const { messages, appliedRules, appliedRuleIndex } = constructMessages(
      withoutMessageIds,
      systemMessage,
      state.config.config.rules,
      state.ui.ruleSettings,
      systemToolsFramework,
    );

    // TODO parallel tool calls will cause issues with this
    // because there will be multiple tool messages, so which one should have applied rules?
    dispatch(
      setAppliedRulesAtIndex({
        index: appliedRuleIndex,
        appliedRules: appliedRules,
      }),
    );

    dispatch(setActive());
    dispatch(setInlineErrorMessage(undefined));

    const precompiledRes = await extra.ideMessenger.request("llm/compileChat", {
      messages,
      options: completionOptions,
    });

    if (precompiledRes.status === "error") {
      if (precompiledRes.error.includes("Not enough context")) {
        dispatch(setInlineErrorMessage("out-of-context"));
        dispatch(setInactive());
        return;
      } else {
        throw new Error(precompiledRes.error);
      }
    }

    const { compiledChatMessages, didPrune, contextPercentage } =
      precompiledRes.content;

    dispatch(setIsPruned(didPrune));
    dispatch(setContextPercentage(contextPercentage));

    // Send request and stream response
    const streamAborter = state.session.streamAborter;
    let gen = extra.ideMessenger.llmStreamChat(
      {
        completionOptions,
        title: selectedChatModel.title,
        messages: compiledChatMessages,
        legacySlashCommandData,
        messageOptions: { precompiled: true },
      },
      streamAborter.signal,
    );
    if (systemToolsFramework && activeTools.length > 0) {
      gen = interceptSystemToolCalls(gen, streamAborter, systemToolsFramework);
    }

    let next = await gen.next();
    while (!next.done) {
      if (!getState().session.isStreaming) {
        dispatch(abortStream());
        break;
      }

      dispatch(streamUpdate(next.value));
      next = await gen.next();
    }

    // Attach prompt log and end thinking for reasoning models
    if (next.done && next.value) {
      dispatch(addPromptCompletionPair([next.value]));

      try {
        extra.ideMessenger.post("devdata/log", {
          name: "chatInteraction",
          data: {
            prompt: next.value.prompt,
            completion: next.value.completion,
            modelProvider: selectedChatModel.underlyingProviderName,
            modelName: selectedChatModel.title,
            modelTitle: selectedChatModel.title,
            sessionId: state.session.id,
            ...(!!activeTools.length && {
              tools: activeTools.map((tool) => tool.function.name),
            }),
            ...(appliedRules.length > 0 && {
              rules: appliedRules.map((rule) => ({
                id: getRuleId(rule),
                rule: rule.rule,
                slug: rule.slug,
              })),
            }),
          },
        });
      } catch (e) {
        console.error("Failed to send dev data interaction log", e);
      }
    }

    // Check if we have any tool calls that were just generated
    const newState = getState();
    const toolSettings = newState.ui.toolSettings;
    const allToolCallStates = selectCurrentToolCalls(newState);

    await Promise.all(
      allToolCallStates.map((tcState) =>
        enhanceParsedArgs(
          extra.ideMessenger,
          dispatch,
          tcState?.toolCall.function.name,
          tcState.toolCallId,
          tcState.parsedArgs,
        ),
      ),
    );

    // Handle tool call execution if there are any generating tool calls
    const allAutoApproved = await handleToolCallExecution(
      dispatch,
      getState,
      activeTools,
      extra.ideMessenger,
    );

    // Only set inactive if not all tools were auto-approved
    // This prevents UI flashing for auto-approved tools
    if (!allAutoApproved) {
      dispatch(setInactive());
    }
  },
);
