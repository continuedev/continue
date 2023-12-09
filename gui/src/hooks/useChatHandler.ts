import { Dispatch } from "@reduxjs/toolkit";

import { SlashCommand } from "core/commands";
import { ExtensionIde } from "core/ide";
import { ChatMessage } from "core/llm/types";
import { useSelector } from "react-redux";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import {
  addContextItems,
  setInactive,
  streamUpdate,
} from "../redux/slices/stateSlice";
import { RootStore } from "../redux/store";

function useChatHandler(dispatch: Dispatch) {
  const defaultModel = useSelector(defaultModelSelector);

  const slashCommands = useSelector(
    (store: RootStore) => store.state.config.slashCommands || []
  );

  const active = useSelector((store: RootStore) => store.state.active);

  function getSlashCommandForInput(
    input: string
  ): [SlashCommand, string] | undefined {
    let slashCommand: SlashCommand | undefined;
    let slashCommandName: string | undefined;
    if (input.startsWith("/")) {
      slashCommandName = input.split(" ")[0].substring(1);
      slashCommand = slashCommands.find(
        (command) => command.name === slashCommandName
      );
    }
    if (!slashCommand || !slashCommandName) {
      return undefined;
    }

    // Convert to actual slash command object with runnable function
    return [slashCommand, input];
  }

  async function _streamNormalInput(messages: ChatMessage[]) {
    for await (const update of defaultModel.streamChat(messages)) {
      if (!active) {
        break;
      }
      dispatch(streamUpdate(update.content));
    }
  }

  async function _streamSlashCommand(
    messages: ChatMessage[],
    slashCommand: SlashCommand,
    input: string
  ) {
    const sdk = {
      input,
      history: messages,
      ide: new ExtensionIde(),
      llm: defaultModel,
      addContextItem: (item) => {
        dispatch(addContextItems([item]));
      },
      options: {}, // TODO: pass options to slash command
    };

    for await (const update of slashCommand.run(sdk)) {
      if (!active) {
        break;
      }
      dispatch(streamUpdate(update));
    }
  }

  async function streamResponse(messages: ChatMessage[]) {
    if (messages.length === 0) {
      return;
    }

    // Determine if the input is a slash command
    const input = messages[-1].content;
    let [slashCommand, commandInput] = getSlashCommandForInput(input);

    if (slashCommand) {
      await _streamSlashCommand(messages, slashCommand, commandInput);
    } else {
      await _streamNormalInput(messages);
    }
    dispatch(setInactive());
  }

  return { streamResponse };
}

export default useChatHandler;
