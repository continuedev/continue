import { JSONContent } from "@tiptap/react";
import { IContextProvider } from "core";
import { ExtensionIde } from "core/ide";
import { getBasename } from "core/util";
import { getContextItems } from "../../hooks/useContextProviders";

interface MentionAttrs {
  label: string;
  id: string;
  query?: string;
}

/**
 * This function converts the input from the editor to a string, resolving any context items
 * Context items are appended to the top of the prompt and then referenced within the input
 * @param editor
 * @returns string representation of the input
 */

async function resolveEditorContent(
  editorState: JSONContent,
  contextProviders: IContextProvider[]
): Promise<string> {
  let paragraphs = [];
  let contextItems: MentionAttrs[] = [];
  for (const p of editorState?.content) {
    if (p.type === "paragraph") {
      const [text, ctxItems] = resolveParagraph(p);
      if (text === "") {
        continue;
      }
      paragraphs.push(text);
      contextItems.push(...ctxItems);
    } else if (p.type === "codeBlock") {
      paragraphs.push(
        "```" + p.attrs.item.name + "\n" + p.attrs.item.content + "\n```"
      );
    } else {
      console.warn("Unexpected content type", p.type);
    }
  }

  let contextItemsText = "";
  const ide = new ExtensionIde();
  for (const item of contextItems) {
    if (item.id.startsWith("/") || item.id.startsWith("\\")) {
      // This is a quick way to resolve @file references
      const basename = getBasename(item.id);
      const contents = await ide.readFile(item.id);
      contextItemsText += `\`\`\`title="${basename}"\n${contents}\n\`\`\`\n`;
    } else {
      const resolvedItems = await getContextItems(
        contextProviders,
        item.id,
        item.query
      );
      for (const resolvedItem of resolvedItems) {
        contextItemsText += `\`\`\`title="${item.label}"\n${resolvedItem.content}\n\`\`\`\n`;
      }
    }
  }

  if (contextItemsText !== "") {
    contextItemsText += "\n";
  }

  const finalText = contextItemsText + paragraphs.join("\n");
  console.log(finalText, editorState?.content);
  return finalText;
}

function resolveParagraph(p: JSONContent): [string, MentionAttrs[]] {
  let text = "";
  const contextItems = [];
  for (const child of p.content || []) {
    if (child.type === "text") {
      text += child.text;
    } else if (child.type === "mention") {
      text += `@${child.attrs.label}`;
      contextItems.push(child.attrs);
    } else if (child.type === "slashcommand") {
      text += child.attrs.label;
    } else {
      console.warn("Unexpected child type", child.type);
    }
  }
  return [text, contextItems];
}

export default resolveEditorContent;
