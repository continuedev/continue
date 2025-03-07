import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage, LLMFullCompletionOptions } from "core";
import { modelSupportsThinking, modelSupportsTools } from "core/llm/autodetect";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectDefaultModel } from "../slices/configSlice";
import {
  abortStream,
  addPromptCompletionPair,
  setToolGenerated,
  streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { callTool } from "./callTool";

export const streamNormalInput = createAsyncThunk<
  void,
  ChatMessage[],
  ThunkApiType
>("chat/streamNormalInput", async (messages, { dispatch, extra, getState }) => {
  // Gather state
  const state = getState();
  const defaultModel = selectDefaultModel(state);
  const toolSettings = state.ui.toolSettings;
  const streamAborter = state.session.streamAborter;
  const useTools = state.ui.useTools;
  if (!defaultModel) {
    throw new Error("Default model not defined");
  }

  const includeTools =
    useTools &&
    modelSupportsTools(defaultModel) &&
    state.session.mode === "chat";

  // Prepare options
  const options: LLMFullCompletionOptions = {};

  // Add tools if supported
  if (includeTools) {
    options.tools = state.config.config.tools.filter(
      (tool) => toolSettings[tool.function.name] !== "disabled",
    );
  }

  // Add thinking options based on UI settings
  const useThinking = state.ui.useThinking;
  const thinkingSettings = state.ui.thinkingSettings;

  if (
    useThinking &&
    modelSupportsThinking(
      defaultModel.provider,
      defaultModel.model,
      defaultModel.title,
      defaultModel.capabilities,
    )
  ) {
    // For Anthropic models
    if (defaultModel.provider === "anthropic") {
      options.thinking = {
        type: "enabled",
        budget_tokens: thinkingSettings.anthropic.budgetTokens,
      };
    }
    // For OpenAI models
    else if (defaultModel.provider === "openai") {
      options.reasoning_effort = thinkingSettings.openai.reasoningEffort;
    }
  } else {
    // Disable thinking if thinking capability is explicitly false
    options.thinking = {
      type: "disabled",
    };
  }

  // Send request
  const gen = extra.ideMessenger.llmStreamChat(
    defaultModel.title,
    streamAborter.signal,
    messages,
    options,
  );

  // Stream response
  let next = await gen.next();
  while (!next.done) {
    if (!getState().session.isStreaming) {
      dispatch(abortStream());
      break;
    }

    dispatch(streamUpdate(next.value));
    next = await gen.next();
  }

  // Attach prompt log
  if (next.done && next.value) {
    dispatch(addPromptCompletionPair([next.value]));

    try {
      if (state.session.mode === "chat") {
        extra.ideMessenger.post("devdata/log", {
          name: "chatInteraction",
          data: {
            prompt: next.value.prompt,
            completion: next.value.completion,
            modelProvider: defaultModel.provider,
            modelTitle: defaultModel.title,
            sessionId: state.session.id,
          },
        });
      }
      // else if (state.session.mode === "edit") {
      //   extra.ideMessenger.post("devdata/log", {
      //     name: "editInteraction",
      //     data: {
      //       prompt: next.value.prompt,
      //       completion: next.value.completion,
      //       modelProvider: defaultModel.provider,
      //       modelTitle: defaultModel.title,
      //     },
      //   });
      // }
    } catch (e) {
      console.error("Failed to send dev data interaction log", e);
    }
  }

  // If it's a tool call that is automatically accepted, we should call it
  const toolCallState = selectCurrentToolCall(getState());
  if (toolCallState) {
    dispatch(setToolGenerated());

    if (
      toolSettings[toolCallState.toolCall.function.name] ===
      "allowedWithoutPermission"
    ) {
      const response = await dispatch(callTool());
      unwrapResult(response);
    }
  }
});
