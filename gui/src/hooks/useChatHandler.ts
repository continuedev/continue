import { Dispatch } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/react";
import {
  ChatHistory,
  ChatHistoryItem,
  ChatMessage,
  ContextItem,
  ContextItemWithId,
  InputModifiers,
  MessageContent,
  PromptLog,
  RangeInFile,
  SlashCommandDescription,
} from "core";
import { constructMessages } from "core/llm/constructMessages";
import { allTools } from "core/tools";
import { getBasename, getRelativePath } from "core/util";
import {
  renderChatMessage,
  renderContextItems,
} from "core/util/messageContent";
import { usePostHog } from "posthog-js/react";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import resolveEditorContent, {
  hasSlashCommandOrContextProvider,
} from "../components/mainInput/resolveInput";
import { IIdeMessenger } from "../context/IdeMessenger";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import {
  abortStream,
  acceptToolCall,
  addContextItemsAtIndex,
  addPromptCompletionPair,
  clearLastEmptyResponse,
  initNewActiveMessage,
  resetNextCodeBlockToApplyIndex,
  resubmitAtIndex,
  setActive,
  setCurCheckpointIndex,
  setInactive,
  setIsGatheringContext,
  setMessageAtIndex,
  streamUpdate,
} from "../redux/slices/stateSlice";
import { RootState } from "../redux/store";
import { updateFileSymbolsFromContextItems } from "../util/symbols";
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
  const streamAborter = useSelector(
    (store: RootState) => store.state.streamAborter,
  );
  const useTools = useSelector((store: RootState) => store.uiState.useTools);
  const toolSettings = useSelector(
    (store: RootState) => store.uiState.toolSettings,
  );

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
    try {
      if (!defaultModel) {
        throw new Error("Default model not defined");
      }
      const gen = ideMessenger.llmStreamChat(
        defaultModel.title,
        streamAborter.signal,
        messages,
        {
          tools: useTools
            ? Object.keys(toolSettings)
                .filter((tool) => toolSettings[tool] !== "disabled")
                .map((toolName) =>
                  allTools.find((tool) => tool.function.name === toolName),
                )
            : undefined,
        },
      );
      let next = await gen.next();

      while (!next.done) {
        if (!activeRef.current) {
          dispatch(abortStream());
          break;
        }
        dispatch(streamUpdate(next.value as ChatMessage));
        next = await gen.next();
      }

      let returnVal = next.value as PromptLog;
      if (returnVal) {
        dispatch(addPromptCompletionPair([returnVal]));
      }
    } catch (e) {
      // If there's an error, we should clear the response so there aren't two input boxes
      dispatch(clearLastEmptyResponse());
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
    return [slashCommand, renderChatMessage({ role: "user", content: input })];
  };

  async function _streamSlashCommand(
    messages: ChatMessage[],
    slashCommand: SlashCommandDescription,
    input: string,
    historyIndex: number,
    selectedCode: RangeInFile[],
    contextItems: ContextItemWithId[],
  ) {
    if (!defaultModel) {
      throw new Error("Default model not defined");
    }

    const modelTitle = defaultModel.title;

    const checkActiveInterval = setInterval(() => {
      if (!activeRef.current) {
        dispatch(abortStream());
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
      streamAborter.signal,
    )) {
      if (!activeRef.current) {
        dispatch(abortStream());
        break;
      }
      if (typeof update === "string") {
        dispatch(streamUpdate(update));
      }
    }
    clearInterval(checkActiveInterval);
  }

  function resetStateForNewMessage() {
    // Reset current code block index
    dispatch(resetNextCodeBlockToApplyIndex());
  }

  async function gatherContext(
    editorState: JSONContent,
    modifiers: InputModifiers,
    ideMessenger: IIdeMessenger,
    promptPreamble?: string,
  ) {
    // Resolve context providers and construct new history
    const shouldGatherContext =
      modifiers.useCodebase || hasSlashCommandOrContextProvider(editorState);

    if (shouldGatherContext) {
      dispatch(
        setIsGatheringContext({
          isGathering: true,
          gatheringMessage: "Gathering Context",
        }),
      );
    }

    let [selectedContextItems, selectedCode, content] =
      await resolveEditorContent(
        editorState,
        modifiers,
        ideMessenger,
        defaultContextProviders,
        dispatch,
      );

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

    await updateFileSymbolsFromContextItems(
      selectedContextItems,
      ideMessenger,
      dispatch,
    );

    if (promptPreamble) {
      typeof content === "string"
        ? (content += promptPreamble)
        : (content.at(-1).text += promptPreamble);
    }

    // dispatch(addContextItems(contextItems));
    return { selectedContextItems, selectedCode, content };
  }

  async function handleErrors(runStream: () => any): Promise<void> {
    try {
      await runStream();
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

  async function streamResponseWithoutErrorHandling(
    editorState: JSONContent,
    modifiers: InputModifiers,
    ideMessenger: IIdeMessenger,
    index?: number,
    promptPreamble?: string,
  ) {
    if (typeof index === "number") {
      dispatch(resubmitAtIndex({ index, editorState }));
    } else {
      dispatch(initNewActiveMessage({ editorState }));
    }

    resetStateForNewMessage();

    if (index) {
      dispatch(setCurCheckpointIndex(Math.floor(index / 2)));
    }

    const { selectedContextItems, selectedCode, content } = await gatherContext(
      editorState,
      modifiers,
      ideMessenger,
      promptPreamble,
    );

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

      // if (slashCommand.name === "multifile-edit") {
      //   dispatch(setIsInMultifileEdit(true));
      // }

      await _streamSlashCommand(
        messages,
        slashCommand,
        commandInput,
        historyIndex,
        selectedCode,
        updatedContextItems,
      );
    }
  }

  async function streamResponse(
    editorState: JSONContent,
    modifiers: InputModifiers,
    ideMessenger: IIdeMessenger,
    index?: number,
    promptPreamble?: string,
  ) {
    await handleErrors(() =>
      streamResponseWithoutErrorHandling(
        editorState,
        modifiers,
        ideMessenger,
        index,
        promptPreamble,
      ),
    );
  }

  async function streamResponseAfterToolCall(
    toolCallId: string,
    toolOutput: ContextItem[],
  ) {
    await handleErrors(async () => {
      resetStateForNewMessage();

      const newMessage: ChatMessage = {
        role: "tool",
        content: renderContextItems(toolOutput),
        toolCallId,
      };

      dispatch(streamUpdate(newMessage));
      dispatch(
        addContextItemsAtIndex({
          index: history.length,
          contextItems: toolOutput.map((contextItem) => ({
            ...contextItem,
            id: {
              providerTitle: "toolCall",
              itemId: toolCallId,
            },
          })),
        }),
      );
      dispatch(acceptToolCall());
      activeRef.current = true;
      dispatch(setActive());

      await new Promise((resolve) => setTimeout(resolve, 0));

      const messages = constructMessages(
        [
          ...history,
          {
            message: newMessage,
            contextItems: [],
          },
        ],
        defaultModel.model,
      );
      await _streamNormalInput(messages);
    });
  }

  return {
    streamResponse,
    streamResponseAfterToolCall,
  };
}

export default useChatHandler;
