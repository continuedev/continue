import { Dispatch } from "@reduxjs/toolkit";

import { JSONContent } from "@tiptap/react";
import {
  ChatHistory,
  ChatHistoryItem,
  ChatMessage,
  LLMReturnValue,
  MessageContent,
  RangeInFile,
  SlashCommandDescription,
} from "core";
import { constructMessages } from "core/llm/constructMessages";
import { stripImages } from "core/llm/countTokens";
import { usePostHog } from "posthog-js/react";
import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import resolveEditorContent from "../components/mainInput/resolveInput";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import {
  addLogs,
  initNewActiveMessage,
  resubmitAtIndex,
  setInactive,
  setMessageAtIndex,
  streamUpdate,
} from "../redux/slices/stateSlice";
import { RootState } from "../redux/store";
import { ideStreamRequest, llmStreamChat, postToIde } from "../util/ide";

function useChatHandler(dispatch: Dispatch) {
  const posthog = usePostHog();

  const defaultModel = useSelector(defaultModelSelector);

  const slashCommands = useSelector(
    (store: RootState) => store.state.config.slashCommands || []
  );

  const contextItems = useSelector(
    (state: RootState) => state.state.contextItems
  );

  const history = useSelector((store: RootState) => store.state.history);
  const active = useSelector((store: RootState) => store.state.active);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  async function _streamNormalInput(messages: ChatMessage[]) {
    const abortController = new AbortController();
    const cancelToken = abortController.signal;
    const gen = llmStreamChat(defaultModel.title, cancelToken, messages);
    let next = await gen.next();

    while (!next.done) {
      if (!activeRef.current) {
        abortController.abort();
        break;
      }
      dispatch(streamUpdate(stripImages((next.value as ChatMessage).content)));
      next = await gen.next();
    }

    let returnVal = next.value as LLMReturnValue;
    if (returnVal) {
      dispatch(addLogs([[returnVal?.prompt, returnVal?.completion]]));
    }
  }

  const getSlashCommandForInput = (
    input: MessageContent
  ): [SlashCommandDescription, string] | undefined => {
    let slashCommand: SlashCommandDescription | undefined;
    let slashCommandName: string | undefined;

    let lastText =
      typeof input === "string"
        ? input
        : input.filter((part) => part.type === "text").slice(-1)[0]?.text || "";

    if (lastText.startsWith("/")) {
      slashCommandName = lastText.split(" ")[0].substring(1);
      slashCommand = slashCommands.find(
        (command) => command.name === slashCommandName
      );
    }
    if (!slashCommand || !slashCommandName) {
      return undefined;
    }

    // Convert to actual slash command object with runnable function
    return [slashCommand, stripImages(input)];
  };

  async function _streamSlashCommand(
    messages: ChatMessage[],
    slashCommand: SlashCommandDescription,
    input: string,
    historyIndex: number,
    selectedCode: RangeInFile[]
  ) {
    const abortController = new AbortController();
    const cancelToken = abortController.signal;
    const modelTitle = defaultModel.title;

    for await (const update of ideStreamRequest(
      "command/run",
      {
        input,
        history: messages,
        modelTitle,
        slashCommandName: slashCommand.name,
        contextItems,
        params: slashCommand.params,
        historyIndex,
        selectedCode,
      },
      cancelToken
    )) {
      if (!activeRef.current) {
        abortController.abort();
        break;
      }
      if (typeof update === "string") {
        dispatch(streamUpdate(update));
      }
    }
  }

  async function streamResponse(editorState: JSONContent, index?: number) {
    try {
      if (typeof index === "number") {
        dispatch(resubmitAtIndex({ index, editorState }));
      } else {
        dispatch(initNewActiveMessage({ editorState }));
      }

      // Resolve context providers and construct new history
      const [contextItems, selectedCode, content] =
        await resolveEditorContent(editorState);

      const message: ChatMessage = {
        role: "user",
        content,
      };
      const historyItem: ChatHistoryItem = {
        message,
        contextItems,
        // : typeof index === "number"
        //   ? history[index].contextItems
        //   : contextItems,
        editorState,
      };

      let newHistory: ChatHistory = [...history.slice(0, index), historyItem];
      const historyIndex = index || newHistory.length - 1;
      dispatch(
        setMessageAtIndex({
          message,
          index: historyIndex,
          contextItems,
        })
      );

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

      if (!commandAndInput) {
        await _streamNormalInput(messages);
      } else {
        const [slashCommand, commandInput] = commandAndInput;
        posthog.capture("step run", {
          step_name: slashCommand.name,
          params: {
            user_input: commandInput,
          },
        });
        await _streamSlashCommand(
          messages,
          slashCommand,
          commandInput,
          historyIndex,
          selectedCode
        );
      }
    } catch (e) {
      console.log("Continue: error streaming response: ", e);
      postToIde("errorPopup", {
        message: `Error streaming response: ${e.message}`,
      });
    } finally {
      dispatch(setInactive());
    }
  }

  return { streamResponse };
}

export default useChatHandler;
