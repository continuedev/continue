import { Dispatch } from "@reduxjs/toolkit";
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
import { stripImages } from "core/util/messageContent";
import { getUriFileExtension } from "core/util/uri";
import { IIdeMessenger } from "../../../context/IdeMessenger";
import { setIsGatheringContext } from "../../../redux/slices/sessionSlice";

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

/**
 * This function converts the input from the editor to a string, resolving any context items
 * Context items are appended to the top of the prompt and then referenced within the input
 */
async function resolveEditorContent({
  editorState,
  modifiers,
  ideMessenger,
  defaultContextProviders,
  availableSlashCommands,
  selectedModelTitle,
  dispatch,
}: ResolveEditorContentInput): Promise<
  [
    ContextItemWithId[],
    RangeInFile[],
    MessageContent,
    (
      | {
          name: string;
          input: string;
        }
      | undefined
    ),
  ]
> {
  let parts: MessagePart[] = [];
  let contextItemAttrs: MentionAttrs[] = [];
  const selectedCode: RangeInFile[] = [];
  let slashCommandName: string | undefined = undefined;
  let slashCommandWithInput: { name: string; input: string } | undefined =
    undefined;
  if (editorState?.content) {
    for (const p of editorState.content) {
      if (p.type === "paragraph") {
        const [text, ctxItems, foundSlashCommand] = resolveParagraph(p);
        // Only take the first slash command
        if (foundSlashCommand && typeof slashCommandName === "undefined") {
          slashCommandName = foundSlashCommand;
        }

        contextItemAttrs.push(...ctxItems);

        if (text === "") {
          continue;
        }

        if (parts[parts.length - 1]?.type === "text") {
          (parts[parts.length - 1] as TextMessagePart).text += "\n" + text;
        } else {
          parts.push({ type: "text", text });
        }
      } else if (p.type === "codeBlock") {
        if (p.attrs?.item) {
          const contextItem = p.attrs.item as ContextItemWithId;
          const rif = ctxItemToRifWithContents(contextItem, true);
          // If not editing, include codeblocks in the prompt
          // If editing is handled by selectedCode below
          if (!contextItem.editing) {
            const fileExtension = getUriFileExtension(rif.filepath);
            // let extName = relativeFilepath.split(".").slice(-1)[0];
            const text =
              "\n\n" +
              "```" +
              fileExtension +
              " " +
              contextItem.description +
              "\n" +
              contextItem.content +
              "\n```";
            if (parts[parts.length - 1]?.type === "text") {
              (parts[parts.length - 1] as TextMessagePart).text += "\n" + text;
            } else {
              parts.push({
                type: "text",
                text,
              });
            }
          }
          selectedCode.push(rif);
        } else {
          console.warn("codeBlock has no item attribute");
        }
      } else if (p.type === "image") {
        parts.push({
          type: "imageUrl",
          imageUrl: {
            url: p.attrs?.src,
          },
        });
      } else {
        console.warn("Unexpected content type", p.type);
      }
    }
  }

  // Add slash command text back in (this could be removed)
  if (slashCommandName) {
    const command = availableSlashCommands.find(
      (c) => c.name === slashCommandWithName,
    );
    if (command) {
      slashCommandWithInput = {
        name: command.name,
        input: "TODO INPUT",
      };
    }
  }
  const getSlashCommandForInput = (
    input: MessageContent,
    slashCommands: SlashCommandDescription[],
  ): [SlashCommandDescription, string] | undefined => {
    let slashCommand: SlashCommandDescription | undefined;
    let slashCommandName: string | undefined;

    let lastText =
      typeof input === "string"
        ? input
        : (
            input.filter((part) => part.type === "text").slice(-1)[0] as
              | TextMessagePart
              | undefined
          )?.text || "";

    if (lastText.startsWith("/")) {
      slashCommandName = lastText.split(" ")[0].substring(1);
      slashCommand = slashCommands.find((command) =>
        lastText.startsWith(command),
      );
    }
    if (!slashCommand || !slashCommandName) {
      return undefined;
    }

    // Convert to actual slash command object with runnable function
    return [slashCommand, renderChatMessage({ role: "user", content: input })];
  };

  if (slashCommand) {
    let lastTextIndex = findLastIndex(parts, (part) => part.type === "text");
    const lastTextPart = parts[lastTextIndex] as TextMessagePart;
    const lastPart = `/${slashCommand} ${lastTextPart?.text || ""}`;
    if (parts.length > 0) {
      lastTextPart.text = lastPart;
    } else {
      parts = [{ type: "text", text: lastPart }];
    }
  }

  const shouldGatherContext = modifiers.useCodebase || slashCommandWithInput;
  if (shouldGatherContext) {
    dispatch(setIsGatheringContext(true));
  }

  let contextItemsText = "";
  let contextItems: ContextItemWithId[] = [];
  for (const item of contextItemAttrs) {
    const result = await ideMessenger.request("context/getContextItems", {
      name: item.itemType === "contextProvider" ? item.id : item.itemType!,
      query: item.query ?? "",
      fullInput: stripImages(parts),
      selectedCode,
      selectedModelTitle,
    });
    if (result.status === "success") {
      const resolvedItems = result.content;
      contextItems.push(...resolvedItems);
      for (const resolvedItem of resolvedItems) {
        contextItemsText += resolvedItem.content + "\n\n";
      }
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
      const codebaseItems = result.content;
      contextItems.push(...codebaseItems);
      for (const codebaseItem of codebaseItems) {
        contextItemsText += codebaseItem.content + "\n\n";
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

  if (contextItemsText !== "") {
    contextItemsText += "\n";
  }

  if (shouldGatherContext) {
    dispatch(setIsGatheringContext(false));
  }

  return [contextItems, selectedCode, parts, slashCommandWithInput];
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
  let text = "";
  const contextItems: MentionAttrs[] = [];
  let slashCommand: string | undefined = undefined;
  for (const child of p.content || []) {
    if (child.type === "text") {
      text += text === "" ? child.text?.trimStart() : child.text;
    } else if (child.type === "mention") {
      text +=
        typeof child.attrs?.renderInlineAs === "string"
          ? child.attrs.renderInlineAs
          : child.attrs?.label;
      contextItems.push(child.attrs as MentionAttrs);
    } else if (child.type === "slashcommand") {
      if (typeof slashCommand === "undefined") {
        slashCommand = child.attrs?.id;
      } else {
        text += child.attrs?.label;
      }
    } else {
      console.warn("Unexpected child type", child.type);
    }
  }
  return [text, contextItems, slashCommand];
}

export default resolveEditorContent;
