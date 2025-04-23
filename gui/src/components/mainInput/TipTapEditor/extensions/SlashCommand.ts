// Adapted from SlashCommand extension (@tiptap/extension-mention/src/mention.ts)

import { Node } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { ComboBoxItem } from "../../types";

export type SlashCommandOptions = {
  suggestion: Omit<SuggestionOptions<ComboBoxItem, ComboBoxItem>, "editor">;
};

export const SlashCommand = Node.create<SlashCommandOptions>({
  name: "slash-command",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        pluginKey: new PluginKey(this.name),
        startOfLine: true,
        command: ({ editor, range, props }) => {
          // First delete the slash character and any text after it
          editor.chain().focus().deleteRange(range).run();

          editor.commands.insertPrompt({
            name: props.title,
            description: props.description,
            prompt: props.content,
          });
        },
      },
    };
  },

  group: "inline",
  inline: true,
  selectable: false,
  atom: true,

  // We don't need attributes since we won't be rendering any node
  addAttributes() {
    return {};
  },

  // No need to parse HTML since we're not rendering anything
  parseHTML() {
    return [];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
