import { Editor } from "@tiptap/core";
import { ContextProviderDescription } from "core";
import { Mention } from "../extensions";

function isEditorContentEmpty(editor: Editor): boolean {
  const editorContent = editor.getJSON();

  if (!editorContent.content || editorContent.content.length === 0) {
    return true;
  }

  const firstNode = editorContent.content[0];
  if (
    firstNode.type === "paragraph" &&
    (firstNode.content || []).length === 0
  ) {
    return true;
  }

  return false;
}

/**
 * inserts the current file context as a removable mention in the editor area
 *
 * skips if there is any other content in the editor
 *
 * uses tiptap's `create` method to create a new node under the hood
 */
export function insertCurrentFileContextMention(
  editor: Editor,
  contextProviders: ContextProviderDescription[],
) {
  if (!isEditorContentEmpty(editor)) {
    return;
  }

  const foundCurrentFileProvider = contextProviders.find(
    (provider) => provider.title === "currentFile",
  );

  if (foundCurrentFileProvider) {
    const node = editor.schema.nodes[Mention.name].create({
      name: foundCurrentFileProvider.displayTitle,
      description: foundCurrentFileProvider.description,
      id: foundCurrentFileProvider.title,
      label: foundCurrentFileProvider.displayTitle,
      renderInlineAs: foundCurrentFileProvider.renderInlineAs,
      type: foundCurrentFileProvider.type,
      itemType: "contextProvider",
    });

    editor
      .chain()
      .insertContent([node.toJSON(), { type: "text", text: " " }]) // add a space after the mention
      .run();
  }
}
