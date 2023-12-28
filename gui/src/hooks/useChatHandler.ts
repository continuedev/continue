import { Dispatch } from "@reduxjs/toolkit";

import { JSONContent } from "@tiptap/react";
import { ChatHistory, ChatHistoryItem, ChatMessage, SlashCommand } from "core";
import { ExtensionIde } from "core/ide";
import { ideStreamRequest } from "core/ide/messaging";
import { constructMessages } from "core/llm/constructMessages";
import { usePostHog } from "posthog-js/react";
import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import resolveEditorContent from "../components/mainInput/resolveInput";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import {
  addContextItems,
  addLogs,
  resubmitAtIndex,
  setInactive,
  streamUpdate,
  submitMessage,
} from "../redux/slices/stateSlice";
import { RootStore } from "../redux/store";
import { errorPopup } from "../util/ide";

function useChatHandler(dispatch: Dispatch) {
  const posthog = usePostHog();

  const defaultModel = useSelector(defaultModelSelector);

  const slashCommands = useSelector(
    (store: RootStore) => store.state.config.slashCommands || []
  );

  const contextItems = useSelector(
    (state: RootStore) => state.state.contextItems
  );
  const history = useSelector((store: RootStore) => store.state.history);
  const contextProviders = useSelector(
    (store: RootStore) => store.state.config.contextProviders || []
  );
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

  async function* _streamSlashCommandFromVsCode(
    messages: ChatMessage[],
    slashCommand: SlashCommand,
    input: string
  ): AsyncGenerator<string> {
    const modelTitle = defaultModel.title;

    for await (const update of ideStreamRequest("runNodeJsSlashCommand", {
      input,
      history: messages,
      modelTitle,
      slashCommandName: slashCommand.name,
      contextItems,
      params: slashCommand.params,
    })) {
      yield update;
    }
  }

  async function _streamSlashCommand(
    messages: ChatMessage[],
    slashCommand: SlashCommand,
    input: string
  ) {
    let generator: AsyncGenerator<string>;
    if (slashCommand.runInNodeJs) {
      generator = _streamSlashCommandFromVsCode(messages, slashCommand, input);
    } else {
      const sdk = {
        input,
        history: messages,
        ide: new ExtensionIde(),
        llm: defaultModel,
        addContextItem: (item) => {
          dispatch(addContextItems([item]));
        },
        contextItems,
        params: slashCommand.params,
      };
      generator = slashCommand.run(sdk);
    }

    // TODO: if the model returned fast enough it would immediately break
    // Ideally you aren't trusting that results of dispatch show up before the first yield
    for await (const update of generator) {
      if (!activeRef.current) {
        break;
      }
      if (typeof update === "string") {
        dispatch(streamUpdate(update));
      }
    }
  }

  async function streamResponse(editorState: JSONContent, index?: number) {
    const content = await resolveEditorContent(editorState, contextProviders);

    try {
      const message: ChatMessage = {
        role: "user",
        content,
      };
      const historyItem: ChatHistoryItem = {
        message,
        contextItems:
          typeof index === "number"
            ? history[index].contextItems
            : contextItems,
        editorState,
      };

      let newHistory: ChatHistory = [];
      if (typeof index === "number") {
        newHistory = [...history.slice(0, index), historyItem];
        dispatch(resubmitAtIndex({ index, content, editorState }));
      } else {
        newHistory = [...history, historyItem];
        dispatch(submitMessage({ message, editorState }));
      }

      // TODO: hacky way to allow rerender
      await new Promise((resolve) => setTimeout(resolve, 0));

      posthog.capture("step run", {
        step_name: "User Input",
        params: {
          user_input: content,
        },
      });
      posthog.capture("userInput", {
        input: content,
      });

      const messages = constructMessages(newHistory);

      // Determine if the input is a slash command
      let commandAndInput = getSlashCommandForInput(content);

      const logs = [];
      const writeLog = async (log: string) => {
        logs.push(log);
      };
      defaultModel.writeLog = writeLog;

      if (!commandAndInput) {
        await _streamNormalInput(messages);
      } else {
        const [slashCommand, commandInput] = commandAndInput;
        await _streamSlashCommand(messages, slashCommand, commandInput);
      }

      const pairedLogs = [];
      for (let i = 0; i < logs.length; i += 2) {
        pairedLogs.push([logs[i], logs[i + 1]]);
      }
      dispatch(addLogs(pairedLogs));
    } catch (e) {
      console.log("Continue: error streaming response: ", e);
      errorPopup(`Error streaming response: ${e}`);
    } finally {
      dispatch(setInactive());
      defaultModel.writeLog = undefined;
    }
  }

  return { streamResponse };
}

export default useChatHandler;
