import { JSONContent } from "@tiptap/react";
import {
  ContextItemWithId,
  MessageContent,
  MessagePart,
  RangeInFile,
} from "core";
import { stripImages } from "core/llm/countTokens";
import { getBasename } from "core/util";
import { ideRequest } from "../../util/ide";
import { WebviewIde } from "../../util/webviewIde";

interface MentionAttrs {
  label: string;
  id: string;
  itemType?: string;
  query?: string;
}

/**
 * This function converts the input from the editor to a string, resolving any context items
 * Context items are appended to the top of the prompt and then referenced within the input
 * @param editor
 * @returns string representation of the input
 */

async function resolveEditorContent(
  editorState: JSONContent
): Promise<[ContextItemWithId[], RangeInFile[], MessageContent]> {
  let parts: MessagePart[] = [];
  let contextItemAttrs: MentionAttrs[] = [];
  const selectedCode: RangeInFile[] = [];
  let slashCommand = undefined;
  for (const p of editorState?.content) {
    if (p.type === "paragraph") {
      const [text, ctxItems, foundSlashCommand] = resolveParagraph(p);
      
      // Only take the first slash command
      if (foundSlashCommand && typeof slashCommand === "undefined") {
        slashCommand = foundSlashCommand;
      }
      if (text === "") {
        continue;
      }

      if (parts[parts.length - 1]?.type === "text") {
        parts[parts.length - 1].text += "\n" + text;
      } else {
        parts.push({ type: "text", text });
      }
      contextItemAttrs.push(...ctxItems);
    } else if (p.type === "codeBlock") {
      if (!p.attrs.item.editing) {
        const text =
          "```" + p.attrs.item.name + "\n" + p.attrs.item.content + "\n```";
        if (parts[parts.length - 1]?.type === "text") {
          parts[parts.length - 1].text += "\n" + text;
        } else {
          parts.push({
            type: "text",
            text,
          });
        }
      }

      const name: string = p.attrs.item.name;
      let lines = name.substring(name.lastIndexOf("(") + 1);
      lines = lines.substring(0, lines.lastIndexOf(")"));
      const [start, end] = lines.split("-");

      selectedCode.push({
        filepath: p.attrs.item.description,
        range: {
          start: { line: parseInt(start) - 1, character: 0 },
          end: { line: parseInt(end) - 1, character: 0 },
        },
      });
    } else if (p.type === "image") {
      parts.push({
        type: "imageUrl",
        imageUrl: {
          url: p.attrs.src,
        },
      });
    } else {
      console.warn("Unexpected content type", p.type);
    }
  }

  let contextItemsText = "";
  let contextItems: ContextItemWithId[] = [];
  const ide = new WebviewIde();
  for (const item of contextItemAttrs) {
    if (item.itemType === "file") {
      // This is a quick way to resolve @file references
      const basename = getBasename(item.id);
      const rawContent = await ide.readFile(item.id);
      const content = `\`\`\`title="${basename}"\n${rawContent}\n\`\`\`\n`;
      contextItemsText += content
      contextItems.push({
        name: basename,
        description: item.id,
        content,
        id: {
          providerTitle: "file",
          itemId: item.id,
        },
      });
    } else {
      const data = {
        name: item.itemType === "contextProvider" ? item.id : item.itemType,
        query: item.query,
        fullInput: stripImages(parts),
        selectedCode,
      };
      const resolvedItems = await ideRequest("context/getContextItems", data);
      contextItems.push(...resolvedItems);
      for (const resolvedItem of resolvedItems) {
        contextItemsText += resolvedItem.content + "\n\n";
      }
    }
  }

  if (contextItemsText !== "") {
    contextItemsText += "\n";
  }

  if (slashCommand) {
    let lastTextIndex = findLastIndex(parts, (part) => part.type === "text");
    const lastPart = `${slashCommand} ${parts[lastTextIndex]?.text || ""}`;
    if (parts.length > 0) {
      parts[lastTextIndex].text = lastPart;
    } else {
      parts = [{ type: "text", text: lastPart }];
    }
  }

  return [contextItems, selectedCode, parts];
}

function findLastIndex<T>(
  array: T[],
  predicate: (value: T, index: number, obj: T[]) => boolean
): number {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i], i, array)) {
      return i;
    }
  }
  return -1; // if no element satisfies the predicate
}

function resolveParagraph(p: JSONContent): [string, MentionAttrs[], string] {
  let text = "";
  const contextItems = [];
  let slashCommand = undefined;
  for (const child of p.content || []) {
    if (child.type === "text") {
      text += text === "" ? child.text.trimStart() : child.text;
    } else if (child.type === "mention") {
      text +=
        typeof child.attrs.renderInlineAs === "string"
          ? child.attrs.renderInlineAs
          : child.attrs.label;
      contextItems.push(child.attrs);
    } else if (child.type === "slashcommand") {
      if (typeof slashCommand === "undefined") {
        slashCommand = child.attrs.id;
      } else {
        text += child.attrs.label;
      }
    } else {
      console.warn("Unexpected child type", child.type);
    }
  }
  return [text, contextItems, slashCommand];
}

export default resolveEditorContent;
