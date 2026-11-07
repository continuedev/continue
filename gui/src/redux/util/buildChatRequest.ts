import type { LLMFullCompletionOptions, ModelDescription, Tool } from "core";
import type { ChatMessage, RuleMetadata } from "core";
import { modelSupportsNativeTools } from "core/llm/toolSupport";
import { rulesEnabledForMode } from "core/llm/rules/rulesByMode";
import { applyToolOverrides } from "core/tools/applyToolOverrides";
import { addSystemMessageToolsToSystemMessage } from "core/tools/systemMessageTools/buildToolsSystemMessage";
import { SystemMessageToolCodeblocksFramework } from "core/tools/systemMessageTools/toolCodeblocks";
import { BuiltInToolNames } from "core/tools/builtIn";
import { taskPlanTailMessage } from "core/util/taskPlan";
import {
  getModeReasoningEffort,
  reasoningOptionsForEffort,
} from "../../util/modeModels";
import { selectActiveTools } from "../selectors/selectActiveTools";
import { selectSelectedChatModel } from "../slices/configSlice";
import type { RootState } from "../store";
import { constructMessages } from "./constructMessages";
import { getBaseSystemMessage } from "./getBaseSystemMessage";

/**
 * Builds completion options with reasoning configuration based on session state and model capabilities.
 *
 * @param baseOptions - Base completion options to extend
 * @param hasReasoningEnabled - Whether reasoning is enabled in the session
 * @param model - The selected model with provider and completion options
 * @returns Completion options with reasoning configuration
 */
export function buildReasoningCompletionOptions(
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

export interface ChatRequest {
  model: ModelDescription;
  activeTools: Tool[];
  /** Tools, reasoning and nothing else: the caller adds the cache options. */
  completionOptions: LLMFullCompletionOptions;
  /** The final system message first, then the conversation. */
  messages: ChatMessage[];
  /**
   * The session's task list as a message to send after `messages`, when the
   * task list tool is offered. Kept apart so that the cache-miss key and the
   * compaction request see only the conversation: the list changes at the
   * tail of every request and must not count as an edit to it.
   */
  taskListMessage: ChatMessage | undefined;
  appliedRules: RuleMetadata[];
  appliedRuleIndex: number;
  /** Set when the model takes tools as text in the system message. */
  systemToolsFramework: SystemMessageToolCodeblocksFramework | undefined;
}

/**
 * Everything about a chat request that comes from the session and config: the
 * tools, the reasoning options, the system message (base message, matched
 * rules, any summary) and the messages. Pure: it dispatches nothing. Used for
 * the chat request and for the compaction request that has to start with the
 * same bytes, so the two cannot drift apart.
 *
 * `history` defaults to the whole session; a shorter one builds the request as
 * it would have been after that many items.
 */
export function buildChatRequest(
  state: RootState,
  history = state.session.history,
): ChatRequest {
  const model = selectSelectedChatModel(state);
  if (!model) {
    throw new Error("No chat model selected");
  }

  // Get tools and apply model-level overrides (disabled, description, etc.)
  let activeTools = selectActiveTools(state);
  if (model.toolOverrides?.length) {
    const { tools: overriddenTools, errors } = applyToolOverrides(
      activeTools,
      model.toolOverrides,
    );
    activeTools = overriddenTools;
    for (const error of errors) {
      if (!error.fatal) {
        console.warn(`Tool override warning: ${error.message}`);
      }
    }
  }

  // Use the centralized selector to determine if system message tools should be used
  const useNativeTools = state.config.config.experimental
    ?.onlyUseSystemMessageTools
    ? false
    : modelSupportsNativeTools(model);
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

  // An explicit reasoning toggle wins; otherwise use the mode's configured
  // reasoning effort (`modeModels.<mode>.reasoningEffort`).
  const modeReasoning =
    state.session.hasReasoningEnabled === undefined
      ? reasoningOptionsForEffort(
          getModeReasoningEffort(state.config.config, state.session.mode),
        )
      : undefined;
  completionOptions = modeReasoning
    ? { ...completionOptions, ...modeReasoning }
    : buildReasoningCompletionOptions(
        completionOptions,
        state.session.hasReasoningEnabled,
        model,
      );

  // Construct messages (excluding system message)
  const baseSystemMessage = getBaseSystemMessage(
    state.session.mode,
    model,
    activeTools,
  );

  const systemMessage = systemToolsFramework
    ? addSystemMessageToolsToSystemMessage(
        systemToolsFramework,
        baseSystemMessage,
        activeTools,
      )
    : baseSystemMessage;

  const withoutMessageIds = history.map((item) => {
    const { id, ...messageWithoutId } = item.message as typeof item.message & {
      id?: string;
    };
    return { ...item, message: messageWithoutId };
  });

  const { messages, appliedRules, appliedRuleIndex } = constructMessages(
    withoutMessageIds as any,
    systemMessage,
    // The per-mode global rules switch (rulesByMode): off for this mode means
    // no rules are matched at all.
    rulesEnabledForMode(state.config.config.rulesByMode, state.session.mode)
      ? state.config.config.rules
      : [],
    state.ui.ruleSettings,
    systemToolsFramework,
  );

  const taskListMessage = activeTools.some(
    (t) => t.function.name === BuiltInToolNames.TaskList,
  )
    ? taskPlanTailMessage(state.session.taskPlan)
    : undefined;

  return {
    model,
    activeTools,
    completionOptions,
    messages,
    taskListMessage,
    appliedRules,
    appliedRuleIndex,
    systemToolsFramework,
  };
}
