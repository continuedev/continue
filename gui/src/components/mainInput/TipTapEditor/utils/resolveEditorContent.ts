import { Dispatch } from "@reduxjs/toolkit";
import Image from "@tiptap/extension-image";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { JSONContent } from "@tiptap/react";
import {
  ContextItemWithId,
  DefaultContextProvider,
  InputModifiers,
  MessageContent,
  MessagePart,
  RangeInFile,
  SlashCommandDescription,
  TextMessagePart,
} from "core";
import { ctxItemToRifWithContents } from "core/commands/util";
import { renderChatMessage, stripImages } from "core/util/messageContent";
import { getUriFileExtension } from "core/util/uri";
import { IIdeMessenger } from "../../../../context/IdeMessenger";
import { setIsGatheringContext } from "../../../../redux/slices/sessionSlice";
import {
  CodeblockExtension,
  MentionExtension,
  SlashCommandExtension,
} from "../extensions";

interface MentionAttrs {
  label: string;
  id: string;
  itemType?: string;
  query?: string;
}

interface ResolveEditorContentInput {
  editorState: JSONContent;
  modifiers: InputModifiers;
  ideMessenger: IIdeMessenger;
  defaultContextProviders: DefaultContextProvider[];
  availableSlashCommands: SlashCommandDescription[];
  selectedModelTitle: string;
  dispatch: Dispatch;
}

type ResolveEditorContentOutput = [
  ContextItemWithId[],
  RangeInFile[],
  MessageContent,
  (
    | {
        command: SlashCommandDescription;
        input: string;
      }
    | undefined
  ),
];

/**
 * Processes editor content and extracts parts, context items, code, and slash commands
 */
function processEditorContent(editorState: JSONContent) {
  const contextItemAttrs: MentionAttrs[] = [];
  const selectedCode: RangeInFile[] = [];
  let slashCommandName: string | undefined;

  const parts = (editorState?.content || []).reduce<MessagePart[]>(
    (parts, p) => {
      switch (p.type) {
        case Paragraph.name: {
          const [text, ctxItems, foundSlashCommand] = resolveParagraph(p);

          // Only take the first slash command
          if (foundSlashCommand && !slashCommandName) {
            slashCommandName = foundSlashCommand;
          }

          contextItemAttrs.push(...ctxItems);

          if (!text) return parts;

          // Merge with previous text part if possible
          if (parts[parts.length - 1]?.type === "text") {
            (parts[parts.length - 1] as TextMessagePart).text += "\n" + text;
            return parts;
          }

          return [...parts, { type: "text", text }];
        }

        case CodeblockExtension.name: {
          if (!p.attrs?.item) {
            console.warn("codeBlock has no item attribute");
            return parts;
          }

          const contextItem = p.attrs.item as ContextItemWithId;
          const rif = ctxItemToRifWithContents(contextItem, true);
          selectedCode.push(rif);

          // If editing, only include in selectedCode
          if (contextItem.editing) {
            return parts;
          }

          const fileExtension = getUriFileExtension(rif.filepath);
          const codeText = [
            "\n\n```",
            fileExtension,
            " ",
            contextItem.description,
            "\n",
            contextItem.content,
            "\n```",
          ].join("");

          if (parts[parts.length - 1]?.type === "text") {
            (parts[parts.length - 1] as TextMessagePart).text +=
              "\n" + codeText;
            return parts;
          }

          return [...parts, { type: "text", text: codeText }];
        }

        case Image.name: {
          return [
            ...parts,
            {
              type: "imageUrl",
              imageUrl: { url: p.attrs?.src },
            },
          ];
        }

        default: {
          console.warn("Unexpected content type", p.type);
          return parts;
        }
      }
    },
    [],
  );

  return { parts, contextItemAttrs, selectedCode, slashCommandName };
}

/**
 * Processes slash commands and prepares the command with input
 */
function processSlashCommand(
  slashCommandName: string | undefined,
  availableSlashCommands: SlashCommandDescription[],
  parts: MessagePart[],
): { command: SlashCommandDescription; input: string } | undefined {
  if (!slashCommandName) return;

  const command = availableSlashCommands.find(
    (c) => c.name === slashCommandName,
  );

  if (!command) return;

  const lastTextIndex = findLastIndex(parts, (part) => part.type === "text");
  const lastTextPart = parts[lastTextIndex] as TextMessagePart;

  let input: string;

  // Get input and add text of last slash command text back in to last text node
  if (lastTextPart) {
    // TODO: only input the slash cmd is currently using
    // improove this comment
    input = renderChatMessage({
      role: "user",
      content: lastTextPart.text,
    }).trimStart();
    lastTextPart.text = `/${command.name} ${lastTextPart.text}`;
  } else {
    input = "";
    parts.push({ type: "text", text: `/${command.name}` });
  }

  return {
    command,
    input,
  };
}

/**
 * Gathers context items from various sources
 */
async function gatherContextItems({
  contextItemAttrs,
  modifiers,
  ideMessenger,
  defaultContextProviders,
  parts,
  selectedCode,
  selectedModelTitle,
}: {
  contextItemAttrs: MentionAttrs[];
  modifiers: InputModifiers;
  ideMessenger: IIdeMessenger;
  defaultContextProviders: DefaultContextProvider[];
  parts: MessagePart[];
  selectedCode: RangeInFile[];
  selectedModelTitle: string;
}): Promise<ContextItemWithId[]> {
  let contextItems: ContextItemWithId[] = [];

  // Process context item attributes
  for (const item of contextItemAttrs) {
    const result = await ideMessenger.request("context/getContextItems", {
      name: item.itemType === "contextProvider" ? item.id : item.itemType!,
      query: item.query ?? "",
      fullInput: stripImages(parts),
      selectedCode,
      selectedModelTitle,
    });
    if (result.status === "success") {
      contextItems.push(...result.content);
    }
  }

  // cmd+enter to use codebase
  if (modifiers.useCodebase) {
    const result = await ideMessenger.request("context/getContextItems", {
      name: "codebase",
      query: "",
      fullInput: stripImages(parts),
      selectedCode,
      selectedModelTitle,
    });

    if (result.status === "success") {
      contextItems.push(...result.content);
    }
  }

  // Include default context providers
  const defaultContextItems = await Promise.all(
    defaultContextProviders.map(async (provider) => {
      const result = await ideMessenger.request("context/getContextItems", {
        name: provider.name,
        query: provider.query ?? "",
        fullInput: stripImages(parts),
        selectedCode,
        selectedModelTitle,
      });
      if (result.status === "success") {
        return result.content;
      } else {
        return [];
      }
    }),
  );
  contextItems.push(...defaultContextItems.flat());

  return contextItems;
}

function findLastIndex<T>(
  array: T[],
  predicate: (value: T, index: number, obj: T[]) => boolean,
): number {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i], i, array)) {
      return i;
    }
  }
  return -1; // if no element satisfies the predicate
}

function resolveParagraph(
  p: JSONContent,
): [string, MentionAttrs[], string | undefined] {
  const contextItems: MentionAttrs[] = [];
  let slashCommand: string | undefined;

  const text = (p.content || [])
    .map((child) => {
      switch (child.type) {
        case Text.name:
          return child.text;
        case MentionExtension.name:
          contextItems.push(child.attrs as MentionAttrs);
          return child.attrs?.renderInlineAs ?? child.attrs?.label;
        case SlashCommandExtension.name:
          if (!slashCommand) {
            slashCommand = child.attrs?.id;
            return "";
          }
          return child.attrs?.label;
        default:
          console.warn("Unexpected child type", child.type);
          return "";
      }
    })
    .join("")
    .trimStart();

  return [text, contextItems, slashCommand];
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
  selectedModelTitle,
  dispatch,
}: ResolveEditorContentInput): Promise<ResolveEditorContentOutput> {
  const { parts, contextItemAttrs, selectedCode, slashCommandName } =
    processEditorContent(editorState);

  const slashCommandWithInput = processSlashCommand(
    slashCommandName,
    availableSlashCommands,
    parts,
  );

  const shouldGatherContext = modifiers.useCodebase || slashCommandWithInput;
  if (shouldGatherContext) {
    dispatch(setIsGatheringContext(true));
  }

  const contextItems = await gatherContextItems({
    contextItemAttrs,
    modifiers,
    ideMessenger,
    defaultContextProviders,
    parts,
    selectedCode,
    selectedModelTitle,
  });

  if (shouldGatherContext) {
    dispatch(setIsGatheringContext(false));
  }

  return [contextItems, selectedCode, parts, slashCommandWithInput];
}
