import { Editor } from "@tiptap/core";
import { ContextProviderDescription } from "core";
import * as ContinueExtensions from "../extensions";

/**
 * inserts the current file context as a removable mention in the editor area
 *
 * uses tiptap's `create` method to create a new node under the hood
 */
export function insertCurrentFileContextMention(
  editor: Editor,
  contextProviders: ContextProviderDescription[],
) {
  const foundCurrentFileProvider = contextProviders.find(
    (provider) => provider.title === "currentFile",
  );

  if (foundCurrentFileProvider) {
    const node = editor.schema.nodes[ContinueExtensions.Mention.name].create({
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
