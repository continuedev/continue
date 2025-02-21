import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import {
  InputModifiers,
  MessageContent,
  SlashCommandDescription,
  TextMessagePart,
} from "core";
import { constructMessages } from "core/llm/constructMessages";
import { renderChatMessage } from "core/util/messageContent";
import posthog from "posthog-js";
import { v4 as uuidv4 } from "uuid";
import { selectDefaultModel } from "../slices/configSlice";
import {
  submitEditorAndInitAtIndex,
  updateHistoryItemAtIndex,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { gatherContext } from "./gatherContext";
import { resetStateForNewMessage } from "./resetStateForNewMessage";
import { streamNormalInput } from "./streamNormalInput";
import { streamSlashCommand } from "./streamSlashCommand";
import { streamThunkWrapper } from "./streamThunkWrapper";
import { updateFileSymbolsFromFiles } from "./updateFileSymbols";

const getSlashCommandForInput = (
  input: MessageContent,
  slashCommands: SlashCommandDescription[],
): [SlashCommandDescription, string] | undefined => {
  let slashCommand: SlashCommandDescription | undefined;
  let slashCommandName: string | undefined;

  let lastText =
    typeof input === "string"
      ? input
      : (
          input.filter((part) => part.type === "text").slice(-1)[0] as
            | TextMessagePart
            | undefined
        )?.text || "";

  if (lastText.startsWith("/")) {
    slashCommandName = lastText.split(" ")[0].substring(1);
    slashCommand = slashCommands.find(
      (command) => command.name === slashCommandName,
    );
  }
  if (!slashCommand || !slashCommandName) {
    return undefined;
  }

  // Convert to actual slash command object with runnable function
  return [slashCommand, renderChatMessage({ role: "user", content: input })];
};

export const streamResponseThunk = createAsyncThunk<
  void,
  {
    editorState: JSONContent;
    modifiers: InputModifiers;
    index?: number;
    promptPreamble?: string;
  },
  ThunkApiType
>(
  "chat/streamResponse",
  async (
    { editorState, modifiers, index, promptPreamble },
    { dispatch, extra, getState },
  ) => {
    await dispatch(
      streamThunkWrapper(async () => {
        const state = getState();
        const useTools = state.ui.useTools;
        const defaultModel = selectDefaultModel(state);
        const slashCommands = state.config.config.slashCommands || [];
        const inputIndex = index ?? state.session.history.length; // Either given index or concat to end

        if (!defaultModel) {
          throw new Error("No chat model selected");
        }

        dispatch(
          submitEditorAndInitAtIndex({ index: inputIndex, editorState }),
        );
        resetStateForNewMessage();

        const result = await dispatch(
          gatherContext({
            editorState,
            modifiers,
            promptPreamble,
          }),
        );
        const unwrapped = unwrapResult(result);
        const { selectedContextItems, selectedCode, content } = unwrapped;

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

        // Construct messages from updated history
        const updatedHistory = getState().session.history;
        const messages = constructMessages(
          [...updatedHistory],
          defaultModel,
          useTools,
        );

        posthog.capture("step run", {
          step_name: "User Input",
          params: {},
        });
        posthog.capture("userInput", {});

        // Determine if the input is a slash command
        let commandAndInput = getSlashCommandForInput(content, slashCommands);

        if (!commandAndInput) {
          unwrapResult(await dispatch(streamNormalInput(messages)));
        } else {
          const [slashCommand, commandInput] = commandAndInput;
          posthog.capture("step run", {
            step_name: slashCommand.name,
            params: {},
          });

          // if (slashCommand.name === "multifile-edit") {
          //   dispatch(setIsInMultifileEdit(true));
          // }

          await dispatch(
            streamSlashCommand({
              messages,
              slashCommand,
              input: commandInput,
              historyIndex: inputIndex,
              selectedCode,
              contextItems: [],
            }),
          );
        }
      }),
    );
  },
);
