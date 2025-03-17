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
import * as URI from "uri-js";
import { v4 as uuidv4 } from "uuid";
import resolveEditorContent from "../../components/mainInput/resolveInput";
import { selectDefaultModel } from "../slices/configSlice";
import {
  cancelToolCall,
  submitEditorAndInitAtIndex,
  updateHistoryItemAtIndex,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
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
    slashCommand = slashCommands.find((command) =>
      lastText.startsWith(`/${command.name} `),
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

        const defaultModel = selectDefaultModel(state);
        if (!defaultModel) {
          throw new Error("No chat model selected");
        }

        const useTools = state.ui.useTools;
        const slashCommands = state.config.config.slashCommands || [];
        const insertIndex = index ?? state.session.history.length; // Either given index or concat to end
        let userMessageIndex = insertIndex;
        const lastItem = state.session.history[insertIndex - 1];

        let cancelsToolId: string | undefined = undefined;
        if (
          lastItem &&
          lastItem.message.role === "assistant" &&
          lastItem.message.toolCalls?.length &&
          lastItem.toolCallState?.toolCallId
        ) {
          cancelsToolId = lastItem.toolCallState.toolCallId;
          userMessageIndex++;
          dispatch(cancelToolCall());
        }

        dispatch(
          submitEditorAndInitAtIndex({
            index: insertIndex,
            editorState,
            cancelsToolId,
          }),
        );
        resetStateForNewMessage();

        const defaultContextProviders =
          state.config.config.experimental?.defaultContext ?? [];

        // Resolve context providers and construct new history
        let [selectedContextItems, selectedCode, content] =
          await resolveEditorContent({
            editorState,
            modifiers,
            ideMessenger: extra.ideMessenger,
            defaultContextProviders,
            dispatch,
            selectedModelTitle: defaultModel.title,
          });

        // Automatically use currently open file
        if (!modifiers.noContext) {
          const usingFreeTrial = defaultModel.provider === "free-trial";

          const currentFileResponse = await extra.ideMessenger.request(
            "context/getContextItems",
            {
              name: "currentFile",
              query: "non-mention-usage",
              fullInput: "",
              selectedCode: [],
              selectedModelTitle: defaultModel.title,
            },
          );
          if (currentFileResponse.status === "success") {
            const items = currentFileResponse.content;
            if (items.length > 0) {
              const currentFile = items[0];
              const uri = currentFile.uri?.value;

              // don't add the file if it's already in the context items
              if (
                uri &&
                !selectedContextItems.find(
                  (item) => item.uri?.value && URI.equal(item.uri.value, uri),
                )
              ) {
                // Limit to 1000 lines if using free trial
                if (usingFreeTrial) {
                  currentFile.content = currentFile.content
                    .split("\n")
                    .slice(0, 1000)
                    .join("\n");
                  if (!currentFile.content.endsWith("```")) {
                    currentFile.content += "\n```";
                  }
                }
                currentFile.id = {
                  providerTitle: "file",
                  itemId: uri,
                };
                selectedContextItems.unshift(currentFile);
              }
            }
          }
        }

        if (promptPreamble) {
          if (typeof content === "string") {
            content = promptPreamble + content;
          } else if (content[0].type === "text") {
            content[0].text = promptPreamble + content[0].text;
          }
        }

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
            index: userMessageIndex,
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
              historyIndex: userMessageIndex,
              selectedCode,
              contextItems: [],
            }),
          );
        }
      }),
    );
  },
);
