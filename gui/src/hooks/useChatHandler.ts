import { Dispatch } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/react";
import {
  ChatHistory,
  ChatHistoryItem,
  ChatMessage,
  ContextItemWithId,
  InputModifiers,
  MessageContent,
  PromptLog,
  RangeInFile,
  SlashCommandDescription,
} from "core";
import { constructMessages } from "core/llm/constructMessages";
import { stripImages } from "core/llm/images";
import { getBasename, getRelativePath } from "core/util";
import { usePostHog } from "posthog-js/react";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import resolveEditorContent, {
  hasSlashCommandOrContextProvider,
} from "../components/mainInput/resolveInput";
import { IIdeMessenger } from "../context/IdeMessenger";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import {
  addPromptCompletionPair,
  clearLastResponse,
  initNewActiveMessage,
  resubmitAtIndex,
  setInactive,
  setIsGatheringContext,
  setIsInMultifileEdit,
  setMessageAtIndex,
  streamUpdate,
} from "../redux/slices/stateSlice";
import { resetNextCodeBlockToApplyIndex } from "../redux/slices/uiStateSlice";
import { RootState } from "../redux/store";
import useHistory from "./useHistory";

function useChatHandler(dispatch: Dispatch, ideMessenger: IIdeMessenger) {
  const posthog = usePostHog();

  const defaultModel = useSelector(defaultModelSelector);
  const defaultContextProviders = useSelector(
    (store: RootState) => store.state.config.experimental?.defaultContext ?? [],
  );

  const slashCommands = useSelector(
    (store: RootState) => store.state.config.slashCommands || [],
  );

  const history = useSelector((store: RootState) => store.state.history);
  const active = useSelector((store: RootState) => store.state.active);
  const activeRef = useRef(active);

  const { saveSession } = useHistory(dispatch);
  const [save, triggerSave] = useState(false);

  useEffect(() => {
    saveSession(false);
  }, [save]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  async function _streamNormalInput(messages: ChatMessage[]) {
    const abortController = new AbortController();
    const cancelToken = abortController.signal;

    try {
      if (!defaultModel) {
        throw new Error("Default model not defined");
      }
      const gen = ideMessenger.llmStreamChat(
        defaultModel.title,
        cancelToken,
        messages,
      );
      let next = await gen.next();

      while (!next.done) {
        if (!activeRef.current) {
          abortController.abort();
          break;
        }
        dispatch(
          streamUpdate(stripImages((next.value as ChatMessage).content)),
        );
        next = await gen.next();
      }

      let returnVal = next.value as PromptLog;
      if (returnVal) {
        dispatch(addPromptCompletionPair([returnVal]));
      }
    } catch (e) {
      // If there's an error, we should clear the response so there aren't two input boxes
      dispatch(clearLastResponse());
    }
  }

  const getSlashCommandForInput = (
    input: MessageContent,
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
        (command) => command.name === slashCommandName,
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
    selectedCode: RangeInFile[],
    contextItems: ContextItemWithId[],
  ) {
    const abortController = new AbortController();
    const cancelToken = abortController.signal;

    if (!defaultModel) {
      throw new Error("Default model not defined");
    }

    const modelTitle = defaultModel.title;

    const checkActiveInterval = setInterval(() => {
      if (!activeRef.current) {
        abortController.abort();
        clearInterval(checkActiveInterval);
      }
    }, 100);

    for await (const update of ideMessenger.streamRequest(
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
      cancelToken,
    )) {
      if (!activeRef.current) {
        abortController.abort();
        break;
      }
      if (typeof update === "string") {
        dispatch(streamUpdate(update));
      }
    }
    clearInterval(checkActiveInterval);
  }

  async function streamResponse(
    editorState: JSONContent,
    modifiers: InputModifiers,
    ideMessenger: IIdeMessenger,
    index?: number,
  ) {
    try {
      if (typeof index === "number") {
        dispatch(resubmitAtIndex({ index, editorState }));
      } else {
        dispatch(initNewActiveMessage({ editorState }));
      }

      // Reset current code block index
      dispatch(resetNextCodeBlockToApplyIndex());

      const shouldGatherContext =
        modifiers.useCodebase || hasSlashCommandOrContextProvider(editorState);

      if (shouldGatherContext) {
        dispatch(setIsGatheringContext(true));
      }

      // Resolve context providers and construct new history
      const [selectedContextItems, selectedCode, content] =
        await resolveEditorContent(
          editorState,
          modifiers,
          ideMessenger,
          defaultContextProviders,
        );

      dispatch(setIsGatheringContext(false));

      // Automatically use currently open file
      if (!modifiers.noContext) {
        const usingFreeTrial = defaultModel?.provider === "free-trial";

        const currentFile = await ideMessenger.ide.getCurrentFile();
        if (currentFile) {
          let currentFileContents = currentFile.contents;
          if (usingFreeTrial) {
            currentFileContents = currentFile.contents
              .split("\n")
              .slice(0, 1000)
              .join("\n");
          }
          if (
            !selectedContextItems.find(
              (item) => item.uri?.value === currentFile.path,
            )
          ) {
            // don't add the file if it's already in the context items
            selectedContextItems.unshift({
              content: `The following file is currently open. Don't reference it if it's not relevant to the user's message.\n\n\`\`\`${getRelativePath(
                currentFile.path,
                await ideMessenger.ide.getWorkspaceDirs(),
              )}\n${currentFileContents}\n\`\`\``,
              name: `Active file: ${getBasename(currentFile.path)}`,
              description: currentFile.path,
              id: {
                itemId: currentFile.path,
                providerTitle: "file",
              },
              uri: {
                type: "file",
                value: currentFile.path,
              },
            });
          }
        }
      }

      // dispatch(addContextItems(contextItems));

      const message: ChatMessage = {
        role: "user",
        content,
      };

      const historyItem: ChatHistoryItem = {
        message,
        contextItems: selectedContextItems,
        editorState,
      };

      let newHistory: ChatHistory = [...history.slice(0, index), historyItem];
      const historyIndex = index || newHistory.length - 1;
      dispatch(
        setMessageAtIndex({
          message,
          index: historyIndex,
          contextItems: selectedContextItems,
        }),
      );

      // TODO: hacky way to allow rerender
      await new Promise((resolve) => setTimeout(resolve, 0));

      posthog.capture("step run", {
        step_name: "User Input",
        params: {},
      });
      posthog.capture("userInput", {});

      const messages = constructMessages(newHistory, defaultModel.model);

      // Determine if the input is a slash command
      let commandAndInput = getSlashCommandForInput(content);

      if (!commandAndInput) {
        await _streamNormalInput(messages);
      } else {
        const [slashCommand, commandInput] = commandAndInput;
        let updatedContextItems = [];
        posthog.capture("step run", {
          step_name: slashCommand.name,
          params: {},
        });

        if (slashCommand.name === "multifile-edit") {
          dispatch(setIsInMultifileEdit(true));
        }

        await _streamSlashCommand(
          messages,
          slashCommand,
          commandInput,
          historyIndex,
          selectedCode,
          updatedContextItems,
        );
      }
    } catch (e: any) {
      console.debug("Error streaming response: ", e);
      ideMessenger.post("showToast", [
        "error",
        `Error streaming response: ${e.message}`,
      ]);
    } finally {
      dispatch(setInactive());
      triggerSave(!save);
    }
  }

  return { streamResponse };
}

export default useChatHandler;
