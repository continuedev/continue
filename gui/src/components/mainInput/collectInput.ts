import { Editor, JSONContent } from "@tiptap/react";
import { IContextProvider } from "core";
import { getContextItems } from "../../hooks/useContextProviders";

/**
 * This function converts the input from the editor to a string, resolving any context items
 * Context items are appended to the top of the prompt and then referenced within the input
 * @param editor
 * @returns string representation of the input
 */

async function resolveEditorContent(
  editor: Editor,
  contextProviders: IContextProvider[]
): Promise<string> {
  const content = editor.getJSON();
  let paragraphs = [];
  let contextItems = [];
  for (const p of content?.content) {
    if (p.type === "paragraph") {
      const [text, ctxItems] = resolveParagraph(p);
      paragraphs.push(text);
      contextItems.push(...ctxItems);
    } else {
      console.warn("Unexpected content type", p.type);
    }
  }

  let contextItemsText = "";
  for (const item of contextItems) {
    contextItemsText += `@${item.id} ${item.title}\n`;
    contextItemsText += getContextItems(contextProviders, item, ""); // TODO: query for context providers
  }

  return contextItemsText + "\n\n" + paragraphs.join("\n");
}

function resolveParagraph(p: JSONContent) {
  let text = "";
  const contextItems = [];
  for (const child of p.content) {
    if (child.type === "text") {
      text += child.text;
    } else if (child.type === "mention") {
      text += child.attrs.id;
      contextItems.push(child.attrs.id);
    } else if (child.type === "command") {
      text += child.attrs.id;
    } else {
      console.warn("Unexpected child type", child.type);
    }
  }
  return [text, contextItems];
}

export default resolveEditorContent;
