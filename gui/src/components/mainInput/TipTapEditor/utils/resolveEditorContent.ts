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
import { stripImages } from "core/util/messageContent";
import { getUriFileExtension } from "core/util/uri";
import { IIdeMessenger } from "../../../../context/IdeMessenger";
import { setIsGatheringContext } from "../../../../redux/slices/sessionSlice";
import { CodeBlock, Mention, PromptBlock } from "../extensions";
import { getRenderedV1Prompt } from "./renderPromptv1";
import { getPromptV2ContextAttrs } from "./renderPromptv2";
import { MentionAttrs } from "./types";

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
    slashedParts,
    contextAttrs: slashContextAttrs,
    legacyCommandWithInput,
  } = await renderSlashCommandPrompt(
    ideMessenger,
    slashCommandName,
    parts,
    availableSlashCommands,
    selectedCode,
  );

  const contextItemAttrs = [...editorContextAttrs, ...slashContextAttrs];

  const shouldGatherContext =
    defaultContextProviders.length > 0 ||
    modifiers.useCodebase ||
    !modifiers.noContext ||
    contextItemAttrs.length > 0;

  if (shouldGatherContext) {
    dispatch(setIsGatheringContext(true));
  }

  const selectedContextItems = await gatherContextItems({
    contextItemAttrs,
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
  commandName: string | undefined,
  parts: MessagePart[],
  availableSlashCommands: SlashCommandDescWithSource[],
  selectedCode: RangeInFile[],
): Promise<{
  slashedParts: MessagePart[];
  legacyCommandWithInput?: {
    command: SlashCommandDescWithSource;
    input: string;
  };
  contextAttrs: MentionAttrs[];
}> {
  const NO_COMMAND = {
    slashedParts: parts,
    legacyCommandWithInput: undefined,
    contextAttrs: [],
  };
  if (!commandName) {
    return NO_COMMAND;
  }
  const command = availableSlashCommands.find((c) => c.name === commandName);
  if (!command) {
    return NO_COMMAND;
  }

  const nonTextParts = parts.filter((part) => part.type !== "text");
  const slashedParts: MessagePart[] = [...nonTextParts];
  const textParts = parts.filter((part) => part.type === "text");

  const userInput = stripImages(textParts).trimStart();

  const legacyCommandWithInput = command.isLegacy
    ? {
        command,
        input: userInput,
      }
    : undefined;

  const contextAttrs: MentionAttrs[] = [];

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
          `Failed to get MCP prompt for slash command ${command.name}`,
        );
      }
      break;
    case "prompt-file-v1":
    case "prompt-file-v2":
      if (!command.promptFile) {
        throw new Error(
          `Invalid prompt file from slash command ${command.name}`,
        );
      }
    case "yaml-prompt-block":
      if (!command.prompt) {
        throw new Error(
          `Invalid/empty prompt from slash command ${command.name}`,
        );
      }
      let renderedPrompt: string;
      if (
        command.source === "prompt-file-v1" ||
        command.prompt.includes("{{{ input }}}")
      ) {
        renderedPrompt = await getRenderedV1Prompt(
          ideMessenger,
          command,
          userInput,
          selectedCode,
        );
      } else {
        const promptFileContextAttrs = await getPromptV2ContextAttrs(
          ideMessenger,
          command,
        );
        contextAttrs.push(...promptFileContextAttrs);
        renderedPrompt = [command.prompt, userInput].join("\n\n");
      }

      // const renderedPrompt = renderPromptFile();
      slashedParts.push({
        type: "text",
        text: renderedPrompt.trim(), // Includes user input
      });
    case "built-in":
    case "invokable-rule":
    case "json-custom-command":
      if (!command.prompt) {
        throw new Error(`Slash command ${command.name} is missing prompt`);
      }
      slashedParts.push({
        type: "text",
        text: `${command.prompt}${userInput ? "\n\n" + userInput : ""}`,
      });
  }
  return {
    slashedParts,
    legacyCommandWithInput,
    contextAttrs,
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
  if (
    modifiers.useCodebase &&
    !contextItemAttrs.some((item) => item.id === "codebase")
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
    !contextItemAttrs.some((item) => item.id === "currentFile")
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
