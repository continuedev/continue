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
  SlashCommandDescWithSource,
  TextMessagePart,
} from "core";
import { ctxItemToRifWithContents } from "core/commands/util";
import { renderTemplatedString } from "core/promptFiles/v1/renderTemplatedString";
import { parsePromptFileV1V2 } from "core/promptFiles/v2/parsePromptFileV1V2";
import { renderChatMessage, stripImages } from "core/util/messageContent";
import { getUriFileExtension } from "core/util/uri";
import { IIdeMessenger } from "../../../../context/IdeMessenger";
import { setIsGatheringContext } from "../../../../redux/slices/sessionSlice";
import { CodeBlock, Mention, PromptBlock } from "../extensions";

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
    contextItemAttrs: editorContextAttrs,
    selectedCode,
    slashCommandName,
  } = processEditorContent(editorState);

  const {
    parts: slashParts,
    legacyCommandWithInput,
    contextAttrs: slashContextAttrs = [],
  } = (await renderSlashCommandPrompt(
    ideMessenger,
    slashCommandName,
    availableSlashCommands,
    parts,
  )) ?? {};

  const contextItemAttrs = [...editorContextAttrs, ...slashContextAttrs];

  const shouldGatherContext =
    modifiers.useCodebase || contextItemAttrs.length > 0;
  if (shouldGatherContext) {
    dispatch(setIsGatheringContext(true));
  }

  const selectedContextItems = await gatherContextItems({
    contextItemAttrs,
    modifiers,
    ideMessenger,
    defaultContextProviders,
    parts: slashParts ?? parts,
    selectedCode,
  });

  if (shouldGatherContext) {
    dispatch(setIsGatheringContext(false));
  }

  return {
    selectedContextItems,
    selectedCode,
    content: slashParts ?? parts,
    legacyCommandWithInput,
  };
}

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
        case PromptBlock.name: {
          slashCommandName = resvolePromptBlock(p);
        }

        case Paragraph.name: {
          const [text, ctxItems] = resolveParagraph(p);

          contextItemAttrs.push(...ctxItems);

          if (!text) return parts;

          // Merge with previous text part if possible
          if (parts[parts.length - 1]?.type === "text") {
            (parts[parts.length - 1] as TextMessagePart).text += "\n" + text;
            return parts;
          }

          return [...parts, { type: "text", text }];
        }

        case CodeBlock.name: {
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
async function renderSlashCommandPrompt(
  ideMessenger: IIdeMessenger,
  slashCommandName: string | undefined,
  availableSlashCommands: SlashCommandDescWithSource[],
  parts: MessagePart[],
): Promise<
  | {
      slashedParts: MessagePart[];
      legacyCommandWithInput?: {
        command: SlashCommandDescWithSource;
        input: string;
      };
      contextAttrs: MentionAttrs[];
    }
  | undefined
> {
  if (!slashCommandName) return;

  const command = availableSlashCommands.find(
    (c) => c.name === slashCommandName,
  );

  if (!command) return;

  const nonTextParts = parts.filter((part) => part.type !== "text");
  const slashedParts: MessagePart[] = [...nonTextParts];
  const textParts = parts.filter((part) => part.type === "text");

  const userInput = textParts.length
    ? renderChatMessage({
        role: "user",
        content: textParts,
      }).trimStart()
    : "";

  const legacyCommandWithInput = command.isLegacy
    ? {
        command,
        input: userInput,
      }
    : undefined;

  const contextItemAttrs: MentionAttrs[] = [];

  switch (command.source) {
    case "built-in-legacy":
    case "config-ts-slash-command":
      /**
       * For legacy slash commands, we simply insert the text "/{name}" in front of the message
       * And then parsing for this is done in core
       */
      slashedParts.push({
        type: "text",
        text: `/${command.name}${command.prompt ? " " + command.prompt : ""}${userInput ? " " + userInput : ""}`,
      });
      break;
    case "mcp-prompt":
      // TODO add support for mcp prompt args using command.mcpArgs
      const args: { [key: string]: string } = {};
      if (command.mcpArgs) {
        command.mcpArgs.forEach((arg, i) => {
          args[arg.name] = "";
        });
      }
      const response = await ideMessenger.request("mcp/getPrompt", {
        serverName: command.mcpServerName!,
        promptName: command.name,
        args: args,
      });
      if (response.status === "success") {
        slashedParts.push({
          type: "text",
          text: `${response.content.prompt}${userInput ? "\n\n" + userInput : ""}`,
        });
      } else {
        throw new Error(
          `Failed to get MCP prompt for slash command ${slashCommandName}`,
        );
      }
      break;
    case ".prompt-file":
      if (!command.promptFile || !command.prompt) {
        throw new Error(
          `Invalid/empty prompt from slash command ${command.name}`,
        );
      }
      const { name, description, systemMessage, prompt } = parsePromptFileV1V2(
        command.promptFile,
        command.prompt,
      );
    case "yaml-prompt-block":
      const [_, renderedPrompt] = await renderPromptFileV2(prompt, {
        config: context.config,
        fullInput: context.input,
        embeddingsProvider: context.config.modelsByRole.embed[0],
        reranker: context.config.modelsByRole.rerank[0],
        llm: context.llm,
        ide: context.ide,
        selectedCode: context.selectedCode,
        fetch: context.fetch,
      });

      // Render prompt template
      let renderedPrompt: string;
      if (customCommand.prompt.includes("{{{ input }}}")) {
        renderedPrompt = await renderTemplatedString(
          customCommand.prompt,
          ide.readFile.bind(ide),
          { input },
        );
      } else {
        const renderedPromptFile = await renderPromptFileV2(
          customCommand.prompt,
          {
            config,
            llm,
            ide,
            selectedCode,
            fetch,
            fullInput: input,
            embeddingsProvider: config.selectedModelByRole.embed,
            reranker: config.selectedModelByRole.rerank,
          },
        );

        renderedPrompt = renderedPromptFile[1];
      }

      const renderedPrompt = renderPromptFile();
      slashedParts.push({
        type: "text",
        text: renderedPrompt, // Includes user input
      });
    case "built-in":
    case "invokable-rule":
    case "json-custom-command":
      if (!command.prompt) {
        throw new Error(`Slash command ${slashCommandName} is missing prompt`);
      }
      slashedParts.push({
        type: "text",
        text: `${command.prompt}${userInput ? "\n\n" + userInput : ""}`,
      });
  }
  return {
    slashedParts,
    legacyCommandWithInput,
    contextAttrs: [],
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
}: {
  contextItemAttrs: MentionAttrs[];
  modifiers: InputModifiers;
  ideMessenger: IIdeMessenger;
  defaultContextProviders: DefaultContextProvider[];
  parts: MessagePart[];
  selectedCode: RangeInFile[];
}): Promise<ContextItemWithId[]> {
  let contextItems: ContextItemWithId[] = [];

  // Process context item attributes
  for (const item of contextItemAttrs) {
    const result = await ideMessenger.request("context/getContextItems", {
      name: item.itemType === "contextProvider" ? item.id : item.itemType!,
      query: item.query ?? "",
      fullInput: stripImages(parts),
      selectedCode,
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

function resvolePromptBlock(p: JSONContent): string | undefined {
  return p.attrs?.item.name;
}

function resolveParagraph(p: JSONContent): [string, MentionAttrs[]] {
  const contextItems: MentionAttrs[] = [];

  const text = (p.content || [])
    .map((child) => {
      switch (child.type) {
        case Text.name:
          return child.text;
        case Mention.name:
          contextItems.push(child.attrs as MentionAttrs);
          return child.attrs?.renderInlineAs ?? child.attrs?.label;

        default:
          console.warn("Unexpected child type", child.type);
          return "";
      }
    })
    .join("")
    .trimStart();

  return [text, contextItems];
}
