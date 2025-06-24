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
import { getPromptV2ContextRequests } from "./renderPromptv2";
import { GetContextRequest } from "./types";

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
 * Processes editor content and extracts parts, context items, code, and slash commands
 */
function processEditorContent(editorState: JSONContent) {
  const contextRequests: GetContextRequest[] = [];
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

          contextRequests.push(...ctxItems);

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

  return { parts, contextRequests, selectedCode, slashCommandName };
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
  contextRequests: GetContextRequest[];
}> {
  const NO_COMMAND = {
    slashedParts: parts,
    legacyCommandWithInput: undefined,
    contextRequests: [],
  };
  if (!commandName) {
    return NO_COMMAND;
  }
  const command = availableSlashCommands.find((c) => c.name === commandName);
  if (!command) {
    return NO_COMMAND;
  }

  const nonTextParts = parts.filter((part) => part.type !== "text");
  const textParts = parts.filter((part) => part.type === "text");
  const slashedParts: MessagePart[] = [...nonTextParts];

  const userInput = stripImages(textParts).trimStart();

  const legacyCommandWithInput = command.isLegacy
    ? {
        command,
        input: userInput,
      }
    : undefined;

  const contextRequests: GetContextRequest[] = [];

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
    case "yaml-prompt-block":
      if (!command.prompt) {
        console.warn(`Invalid/empty prompt from slash command ${command.name}`);
        break;
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
        const promptFileCtxRequests = await getPromptV2ContextRequests(
          ideMessenger,
          command,
        );
        contextRequests.push(...promptFileCtxRequests);
        renderedPrompt = [command.prompt, userInput].join("\n\n");
      }

      if (renderedPrompt) {
        slashedParts.push({
          type: "text",
          text: renderedPrompt.trim(), // Includes user input
        });
      } else {
        console.warn(
          `Invalid/empty prompt + input from slash command ${command.name}`,
        );
      }

      break;
    case "built-in":
    case "invokable-rule":
    case "json-custom-command":
      if (!command.prompt) {
        console.warn(`Slash command ${command.name} is missing prompt`);
        break;
      }
      const rendered =
        `${command.prompt}${userInput ? "\n\n" + userInput : ""}`.trim();
      if (rendered) {
        slashedParts.push({
          type: "text",
          text: rendered,
        });
      } else {
        console.warn(
          `Invalid/empty prompt + input from slash command ${command.name}`,
        );
      }
    default:
      break;
  }
  return {
    slashedParts,
    legacyCommandWithInput,
    contextRequests,
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

function resvolePromptBlock(p: JSONContent): string | undefined {
  return p.attrs?.item.name;
}

function resolveParagraph(p: JSONContent): [string, GetContextRequest[]] {
  const contextRequests: GetContextRequest[] = [];

  const text = (p.content || [])
    .map((child) => {
      switch (child.type) {
        case Text.name:
          return child.text;
        case Mention.name:
          const attrs = child.attrs as MentionAttrs;
          contextRequests.push({
            provider:
              attrs.itemType === "contextProvider" ? attrs.id : attrs.itemType!,
          });
          return child.attrs?.renderInlineAs ?? child.attrs?.label;

        default:
          console.warn("Unexpected child type", child.type);
          return "";
      }
    })
    .join("")
    .trimStart();

  return [text, contextRequests];
}
