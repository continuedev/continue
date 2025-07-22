import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { LLMFullCompletionOptions, ModelDescription, Tool } from "core";
import { modelSupportsTools } from "core/llm/autodetect";
import { getRuleId } from "core/llm/rules/getSystemMessageWithRules";
import { ToCoreProtocol } from "core/protocol";
import { BuiltInToolNames } from "core/tools/builtIn";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  setActive,
  setAppliedRulesAtIndex,
  setContextPercentage,
  setInactive,
  setInlineErrorMessage,
  setIsPruned,
  setToolGenerated,
  streamUpdate,
} from "../slices/sessionSlice";
import { AppThunkDispatch, RootState, ThunkApiType } from "../store";
import {
  constructMessages,
  getBaseSystemMessage,
} from "../util/constructMessages";

import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import { callToolById } from "./callToolById";

/**
 * Handles the execution of tool calls that may be automatically accepted.
 * Sets all tools as generated first, then executes auto-approved tool calls.
 */
async function handleToolCallExecution(
  dispatch: AppThunkDispatch,
  getState: () => RootState,
): Promise<void> {
  const newState = getState();
  const toolSettings = newState.ui.toolSettings;
  const allToolCallStates = selectCurrentToolCalls(newState);

  // Only process tool calls that are in "generating" status (newly created during this streaming session)
  const toolCallStates = allToolCallStates.filter(
    (toolCallState) => toolCallState.status === "generating",
  );

  // If no generating tool calls, nothing to process
  if (toolCallStates.length === 0) {
    return;
  }

  // Check if ALL tool calls are auto-approved - if not, wait for user approval
  const allAutoApproved = toolCallStates.every(
    (toolCallState) =>
      toolSettings[toolCallState.toolCall.function.name] ===
      "allowedWithoutPermission",
  );

  // Set all tools as generated first
  toolCallStates.forEach((toolCallState) => {
    dispatch(
      setToolGenerated({
        toolCallId: toolCallState.toolCallId,
        tools: newState.config.config.tools,
      }),
    );
  });

  // Only run if we have auto-approve for all
  if (allAutoApproved && toolCallStates.length > 0) {
    const toolCallPromises = toolCallStates.map(async (toolCallState) => {
      const response = await dispatch(
        callToolById({ toolCallId: toolCallState.toolCallId }),
      );
      unwrapResult(response);
    });

    await Promise.all(toolCallPromises);
  }
}

/**
 * Filters tools based on the selected model's capabilities.
 * Returns either the edit file tool or search and replace tool, but not both.
 */
function filterToolsForModel(
  tools: Tool[],
  selectedModel: ModelDescription,
): Tool[] {
  const editFileTool = tools.find(
    (tool) => tool.function.name === BuiltInToolNames.EditExistingFile,
  );
  const searchAndReplaceTool = tools.find(
    (tool) => tool.function.name === BuiltInToolNames.SearchAndReplaceInFile,
  );

  // If we don't have both tools, return tools as-is
  if (!editFileTool || !searchAndReplaceTool) {
    return tools;
  }

  // Determine which tool to use based on the model
  const shouldUseFindReplace = shouldUseFindReplaceEdits(selectedModel);

  // Filter out the unwanted tool
  return tools.filter((tool) => {
    if (tool.function.name === BuiltInToolNames.EditExistingFile) {
      return !shouldUseFindReplace;
    }
    if (tool.function.name === BuiltInToolNames.SearchAndReplaceInFile) {
      return shouldUseFindReplace;
    }
    return true;
  });
}

/**
 * Determines whether to use search and replace tool instead of edit file
 * Right now we only know that this is reliable with Claude models
 */
function shouldUseFindReplaceEdits(model: ModelDescription): boolean {
  return model.model.includes("claude");
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
    const allActiveTools = selectActiveTools(state);
    const activeTools = filterToolsForModel(allActiveTools, selectedChatModel);
    const toolsSupported = modelSupportsTools(selectedChatModel);

    // Construct completion options
    let completionOptions: LLMFullCompletionOptions = {};
    if (toolsSupported && activeTools.length > 0) {
      completionOptions = {
        tools: activeTools,
      };
    }

    if (state.session.hasReasoningEnabled) {
      completionOptions = {
        ...completionOptions,
        reasoning: true,
        reasoningBudgetTokens: completionOptions.reasoningBudgetTokens ?? 2048,
      };
    }

    // Construct messages (excluding system message)
    const baseSystemMessage = getBaseSystemMessage(
      state.session.mode,
      selectedChatModel,
    );

    const withoutMessageIds = state.session.history.map((item) => {
      const { id, ...messageWithoutId } = item.message;
      return { ...item, message: messageWithoutId };
    });
    const { messages, appliedRules, appliedRuleIndex } = constructMessages(
      withoutMessageIds,
      baseSystemMessage,
      state.config.config.rules,
      state.ui.ruleSettings,
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
    const gen = extra.ideMessenger.llmStreamChat(
      {
        completionOptions,
        title: selectedChatModel.title,
        messages: compiledChatMessages,
        legacySlashCommandData,
        messageOptions: { precompiled: true },
      },
      streamAborter.signal,
    );

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
    dispatch(setInactive());
    await handleToolCallExecution(dispatch, getState);
  },
);
