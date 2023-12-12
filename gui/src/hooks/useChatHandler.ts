import { Dispatch } from "@reduxjs/toolkit";

import { SlashCommand } from "core/commands";
import { ExtensionIde } from "core/ide";
import { constructMessages } from "core/llm/constructMessages";
import { ChatHistory, ChatHistoryItem, ChatMessage } from "core/llm/types";
import { usePostHog } from "posthog-js/react";
import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import {
  addContextItems,
  resubmitAtIndex,
  setInactive,
  streamUpdate,
  submitMessage,
} from "../redux/slices/stateSlice";
import { RootStore } from "../redux/store";

function useChatHandler(dispatch: Dispatch) {
  const posthog = usePostHog();

  const defaultModel = useSelector(defaultModelSelector);

  const slashCommands = useSelector(
    (store: RootStore) => store.state.config.slashCommands || []
  );

  const contextItems = useSelector(
    (store: RootStore) => store.state.contextItems
  );
  const history = useSelector((store: RootStore) => store.state.history);

  const active = useSelector((store: RootStore) => store.state.active);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  async function _streamNormalInput(messages: ChatMessage[]) {
    for await (const update of defaultModel.streamChat(messages)) {
      if (!activeRef.current) {
        break;
      }
      dispatch(streamUpdate(update.content));
    }
  }

  const getSlashCommandForInput = (
    input: string
  ): [SlashCommand, string] | undefined => {
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
  };

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
      contextItems,
      options: {}, // TODO: pass options to slash command
    };

    // TODO: if the model returned fast enough it would immediately break
    // Ideally you aren't trusting that results of dispatch show up before the first yield
    for await (const update of slashCommand.run(sdk)) {
      if (!activeRef.current) {
        break;
      }
      if (typeof update === "string") {
        dispatch(streamUpdate(update));
      }
    }
  }

  async function streamResponse(input: string, index?: number) {
    const message: ChatMessage = {
      role: "user",
      content: input,
    };
    const historyItem: ChatHistoryItem = {
      message,
      contextItems,
    };

    let newHistory: ChatHistory = [];
    if (typeof index === "number") {
      newHistory = [...history.slice(0, index), historyItem];
      dispatch(resubmitAtIndex({ index, content: input }));
    } else {
      newHistory = [...history, historyItem];
      console.log("Submitting message");
      dispatch(submitMessage(message));
    }

    posthog.capture("step run", {
      step_name: "User Input",
      params: {
        user_input: input,
      },
    });
    posthog.capture("userInput", {
      input,
    });

    const messages = constructMessages(newHistory);

    // Determine if the input is a slash command
    let commandAndInput = getSlashCommandForInput(input);

    if (!commandAndInput) {
      await _streamNormalInput(messages);
    } else {
      const [slashCommand, commandInput] = commandAndInput;
      await _streamSlashCommand(messages, slashCommand, commandInput);
    }
    dispatch(setInactive());
  }

  return { streamResponse };
}

export default useChatHandler;
