import { Dispatch } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/react";
import {
  ContextItemWithId,
  DefaultContextProvider,
  InputModifiers,
  MessageContent,
  MessagePart,
  RangeInFile,
  SlashCommandDescWithSource,
} from "core";
import { stripImages } from "core/util/messageContent";
import { IIdeMessenger } from "../../../../context/IdeMessenger";
import { setIsGatheringContext } from "../../../../redux/slices/sessionSlice";
import { processEditorContent } from "./processEditorContent";
import { renderSlashCommandPrompt } from "./renderSlashCommand";
import { GetContextRequest } from "./types";

interface ResolveEditorContentInput {
  editorState: JSONContent;
  modifiers: InputModifiers;
  ideMessenger: IIdeMessenger;
  defaultContextProviders: DefaultContextProvider[];
  availableSlashCommands: SlashCommandDescWithSource[];
  dispatch: Dispatch;
}

interface ResolveEditorContentOutput {
  selectedContextItems: ContextItemWithId[];
  selectedCode: RangeInFile[];
  content: MessageContent;
  legacyCommandWithInput:
    | {
        command: SlashCommandDescWithSource;
        input: string;
      }
    | undefined;
}

/**
 * This function converts the input from the editor to a string, resolving any context items
 * Context items are appended to the top of the prompt and then referenced within the input
 */
export async function resolveEditorContent({
  editorState,
  modifiers,
  ideMessenger,
  defaultContextProviders,
  availableSlashCommands,
  dispatch,
}: ResolveEditorContentInput): Promise<ResolveEditorContentOutput> {
  const {
    parts,
    contextRequests: editorContextRequests,
    selectedCode,
    slashCommandName,
  } = processEditorContent(editorState);

  const {
    slashedParts,
    contextRequests: slashContextRequests,
    legacyCommandWithInput,
  } = await renderSlashCommandPrompt(
    ideMessenger,
    slashCommandName,
    parts,
    availableSlashCommands,
    selectedCode,
  );

  const contextRequests = [...editorContextRequests, ...slashContextRequests];

  const shouldGatherContext =
    defaultContextProviders.length > 0 ||
    modifiers.useCodebase ||
    !modifiers.noContext ||
    contextRequests.length > 0;

  if (shouldGatherContext) {
    dispatch(setIsGatheringContext(true));
  }

  const selectedContextItems = await gatherContextItems({
    contextRequests,
    modifiers,
    ideMessenger,
    defaultContextProviders,
    parts: slashedParts,
    selectedCode,
  });

  if (shouldGatherContext) {
    dispatch(setIsGatheringContext(false));
  }

  return {
    selectedContextItems,
    selectedCode,
    content: slashedParts,
    legacyCommandWithInput,
  };
}

/**
 * Gathers context items from various sources
 */
async function gatherContextItems({
  contextRequests,
  modifiers,
  ideMessenger,
  defaultContextProviders,
  parts,
  selectedCode,
}: {
  contextRequests: GetContextRequest[];
  modifiers: InputModifiers;
  ideMessenger: IIdeMessenger;
  defaultContextProviders: DefaultContextProvider[];
  parts: MessagePart[];
  selectedCode: RangeInFile[];
}): Promise<ContextItemWithId[]> {
  const defaultRequests: GetContextRequest[] = defaultContextProviders.map(
    (def) => ({
      provider: def.name,
      query: def.query,
    }),
  );
  const withDefaults = [...contextRequests, ...defaultRequests];
  const deduplicatedInputs = withDefaults.reduce<GetContextRequest[]>(
    (acc, item) => {
      if (
        !acc.some((i) => i.provider === item.provider && i.query === item.query)
      ) {
        acc.push(item);
      }
      return acc;
    },
    [],
  );
  let contextItems: ContextItemWithId[] = [];

  // Process context item attributes
  for (const item of deduplicatedInputs) {
    const result = await ideMessenger.request("context/getContextItems", {
      name: item.provider,
      query: item.query ?? "",
      fullInput: stripImages(parts),
      selectedCode,
    });
    if (result.status === "success") {
      contextItems.push(...result.content);
    }
  }

  // cmd+enter to use codebase
  if (
    modifiers.useCodebase &&
    !deduplicatedInputs.some((item) => item.provider === "codebase")
  ) {
    const result = await ideMessenger.request("context/getContextItems", {
      name: "codebase",
      query: "",
      fullInput: stripImages(parts),
      selectedCode,
    });

    if (result.status === "success") {
      contextItems.push(...result.content);
    }
  }

  // noContext modifier adds currently open file if it's not already present
  if (
    !modifiers.noContext &&
    !deduplicatedInputs.some((item) => item.provider === "currentFile")
  ) {
    const currentFileResponse = await ideMessenger.request(
      "context/getContextItems",
      {
        name: "currentFile",
        query: "non-mention-usage",
        fullInput: "",
        selectedCode: [],
      },
    );
    if (currentFileResponse.status === "success") {
      const currentFile = currentFileResponse.content[0];
      if (currentFile.uri?.value) {
        currentFile.id = {
          providerTitle: "file",
          itemId: currentFile.uri.value,
        };
        contextItems.unshift(currentFile);
      }
    }
  }

  // Deduplicates based on either providerTitle + itemId or uri type + value
  const deduplicatedOutputs = contextItems.reduce<ContextItemWithId[]>(
    (acc, item) => {
      if (
        !acc.some(
          (i) =>
            (i.id.providerTitle === item.id.providerTitle &&
              i.id.itemId === item.id.itemId) ||
            (i.uri &&
              item.uri &&
              i.uri.type === item.uri.type &&
              i.uri.value === item.uri.value),
        )
      ) {
        acc.push(item);
      }
      return acc;
    },
    [],
  );
  return deduplicatedOutputs;
}
