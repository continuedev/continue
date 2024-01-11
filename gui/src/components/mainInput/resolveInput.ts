import { JSONContent } from "@tiptap/react";
import { ContextItemWithId, EmbeddingsProvider, IContextProvider } from "core";
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
  contextProviders: IContextProvider[],
  embeddingsProvider?: EmbeddingsProvider
): Promise<[ContextItemWithId[], string]> {
  let paragraphs = [];
  let contextItemAttrs: MentionAttrs[] = [];
  let slashCommand = undefined;
  for (const p of editorState?.content) {
    if (p.type === "paragraph") {
      const [text, ctxItems, foundSlashCommand] = resolveParagraph(p);
      if (foundSlashCommand && typeof slashCommand === "undefined") {
        slashCommand = foundSlashCommand;
      }
      if (text === "") {
        continue;
      }
      paragraphs.push(text);
      contextItemAttrs.push(...ctxItems);
    } else if (p.type === "codeBlock") {
      if (!p.attrs.item.editing) {
        paragraphs.push(
          "```" + p.attrs.item.name + "\n" + p.attrs.item.content + "\n```"
        );
      }
    } else {
      console.warn("Unexpected content type", p.type);
    }
  }

  let contextItemsText = "";
  let contextItems: ContextItemWithId[] = [];
  const ide = new ExtensionIde();
  for (const item of contextItemAttrs) {
    if (item.id.startsWith("/") || item.id.startsWith("\\")) {
      // This is a quick way to resolve @file references
      const basename = getBasename(item.id);
      const content = await ide.readFile(item.id);
      contextItemsText += `\`\`\`title="${basename}"\n${content}\n\`\`\`\n`;
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
      const resolvedItems = await getContextItems(
        contextProviders,
        item.id,
        item.query,
        {
          fullInput: paragraphs.join("\n"),
          embeddingsProvider,
        }
      );
      contextItems.push(...resolvedItems);
      for (const resolvedItem of resolvedItems) {
        contextItemsText += resolvedItem.content + "\n\n";
      }
    }
  }

  if (contextItemsText !== "") {
    contextItemsText += "\n";
  }

  let finalText = contextItemsText + paragraphs.join("\n");
  if (slashCommand) {
    finalText = `${slashCommand} ${finalText}`;
  }

  return [contextItems, finalText];
}

function resolveParagraph(p: JSONContent): [string, MentionAttrs[], string] {
  let text = "";
  const contextItems = [];
  let slashCommand = undefined;
  for (const child of p.content || []) {
    if (child.type === "text") {
      text += child.text;
    } else if (child.type === "mention") {
      if (!["codebase"].includes(child.attrs.id)) {
        text += child.attrs.label;
      }
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
