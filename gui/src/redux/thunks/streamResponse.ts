import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import { InputModifiers, ToolResultChatMessage, UserChatMessage } from "core";
import { constructMessages } from "core/llm/constructMessages";
import { getApplicableRules } from "core/llm/rules/getSystemMessageWithRules";
import posthog from "posthog-js";
import { v4 as uuidv4 } from "uuid";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils/resolveEditorContent";
import { getBaseSystemMessage } from "../../util";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  setAppliedRulesAtIndex,
  submitEditorAndInitAtIndex,
  updateHistoryItemAtIndex,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { resetStateForNewMessage } from "./resetStateForNewMessage";
import { streamNormalInput } from "./streamNormalInput";
import { streamThunkWrapper } from "./streamThunkWrapper";
import { updateFileSymbolsFromFiles } from "./updateFileSymbols";

export const streamResponseThunk = createAsyncThunk<
  void,
  {
    editorState: JSONContent;
    modifiers: InputModifiers;
    index?: number;
  },
  ThunkApiType
>(
  "chat/streamResponse",
  async ({ editorState, modifiers, index }, { dispatch, extra, getState }) => {
    await dispatch(
      streamThunkWrapper(async () => {
        const state = getState();
        const selectedChatModel = selectSelectedChatModel(state);
        const inputIndex = index ?? state.session.history.length; // Either given index or concat to end

        if (!selectedChatModel) {
          throw new Error("No chat model selected");
        }

        dispatch(
          submitEditorAndInitAtIndex({ index: inputIndex, editorState }),
        );
        resetStateForNewMessage();

        const defaultContextProviders =
          state.config.config.experimental?.defaultContext ?? [];

        if (!selectedChatModel) {
          console.error(
            "gatherContext thunk: Cannot gather context, no model selected",
          );
          throw new Error("No chat model selected");
        }

        // Resolve context providers and construct new history
        const {
          selectedContextItems,
          selectedCode,
          content,
          legacyCommandWithInput,
        } = await resolveEditorContent({
          editorState,
          modifiers,
          ideMessenger: extra.ideMessenger,
          defaultContextProviders,
          availableSlashCommands: state.config.config.slashCommands,
          dispatch,
        });

        // symbols for both context items AND selected codeblocks
        const filesForSymbols = [
          ...selectedContextItems
            .filter((item) => item.uri?.type === "file" && item?.uri?.value)
            .map((item) => item.uri!.value),
          ...selectedCode.map((rif) => rif.filepath),
        ];
        dispatch(updateFileSymbolsFromFiles(filesForSymbols));

        dispatch(
          updateHistoryItemAtIndex({
            index: inputIndex,
            updates: {
              message: {
                role: "user",
                content,
                id: uuidv4(),
              },
              contextItems: selectedContextItems,
            },
          }),
        );

        // Get updated history after the update
        const updatedHistory = getState().session.history;

        // Determine which rules apply to this message
        const userMsg = updatedHistory[inputIndex].message;
        const rules = getState().config.config.rules;
        const rulePolicies = getState().ui.ruleSettings;

        // Calculate applicable rules once
        // We need to check the message type to match what getApplicableRules expects
        const applicableRules = getApplicableRules(
          userMsg.role === "user" || userMsg.role === "tool"
            ? (userMsg as UserChatMessage | ToolResultChatMessage)
            : undefined,
          rules,
          selectedContextItems,
          rulePolicies,
        );

        // Store in history for UI display
        dispatch(
          setAppliedRulesAtIndex({
            index: inputIndex,
            appliedRules: applicableRules,
          }),
        );

        const messageMode = getState().session.mode;
        const baseChatOrAgentSystemMessage = getBaseSystemMessage(
          selectedChatModel,
          messageMode,
        );

        const messages = constructMessages(
          messageMode,
          [...updatedHistory],
          baseChatOrAgentSystemMessage,
          applicableRules,
          rulePolicies,
        );

        posthog.capture("step run", {
          step_name: "User Input",
          params: {},
        });
        posthog.capture("userInput", {});

        if (legacyCommandWithInput) {
          posthog.capture("step run", {
            step_name: legacyCommandWithInput.command.name,
            params: {},
          });
        }

        unwrapResult(
          await dispatch(
            streamNormalInput({
              messages,
              legacySlashCommandData: legacyCommandWithInput
                ? {
                    command: legacyCommandWithInput.command,
                    contextItems: selectedContextItems,
                    historyIndex: inputIndex,
                    input: legacyCommandWithInput.input,
                    selectedCode,
                  }
                : undefined,
            }),
          ),
        );
      }),
    );
  },
);
