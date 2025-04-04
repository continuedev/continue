// Adapted from SlashCommand extension (@tiptap/extension-mention/src/mention.ts)

import { mergeAttributes, Node } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { ContextItemWithId, SlashCommandDescription } from "core";
import { MAIN_EDITOR_INPUT_ID } from "../../../../pages/gui/Chat";
import { ComboBoxItem } from "../../types";
import { PromptExtension } from "./PromptExtension/PromptExtension";

export type SlashCommandOptions = {
  HTMLAttributes: Record<string, any>;
  renderText: (props: { node: ProseMirrorNode }) => string;
  suggestion: Omit<SuggestionOptions<ComboBoxItem, ComboBoxItem>, "editor">;
};

export const SLASH_CMD_NAME = "slash-command";
export const SLASH_CMD_SUGGESTION_CHAR = "/";

export const SlashCommandPluginKey = new PluginKey(SLASH_CMD_NAME);

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    slashCommand: {
      /**
       * Insert a slash command and its associated prompt block
       * @param command The slash command description
       */
      insertSlashCommand: (command: SlashCommandDescription) => ReturnType;

      /**
       * Clear the slash command content from the editor
       */
      clearSlashCommand: () => ReturnType;
    };
  }
}

export const SlashCommandExtension = Node.create<SlashCommandOptions>({
  name: SLASH_CMD_NAME,

  addOptions() {
    return {
      HTMLAttributes: {},
      renderText({ node }) {
        return node.attrs.label ?? node.attrs.id;
      },
      suggestion: {
        char: SLASH_CMD_SUGGESTION_CHAR,
        pluginKey: SlashCommandPluginKey,
        startOfLine: true,
        command: ({ editor, range, props }) => {
          // increase range.to by one when the next node is of type "text"
          // and starts with a space character
          const nodeAfter = editor.view.state.selection.$to.nodeAfter;
          const overrideSpace = nodeAfter?.text?.startsWith(" ");

          if (overrideSpace) {
            range.to += 1;
          }

          editor.commands.insertSlashCommand({
            name: props.title,
            description: props.description,
            prompt: props.content,
          });

          window.getSelection()?.collapseToEnd();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes[this.name];
          const allow = !!$from.parent.type.contentMatch.matchType(type);

          return allow;
        },
      },
    };
  },

  group: "inline",

  inline: true,

  selectable: false,

  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }

          return {
            "data-id": attributes.id,
          };
        },
      },

      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {};
          }

          return {
            "data-label": attributes.label,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      this.options.renderText({
        node,
      }),
    ];
  },

  renderText({ node }) {
    return this.options.renderText({
      node,
    });
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        // Get a reference to the editor
        const editor = this.editor;

        // First try to find if we're at a slash command
        const result = editor.commands.command(({ tr, state }) => {
          let isSlashCommand = false;
          const { selection } = state;
          const { empty, anchor } = selection;

          if (!empty) {
            return false;
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isSlashCommand = true;
              tr.insertText(
                this.options.suggestion.char || "",
                pos,
                pos + node.nodeSize,
              );

              return false;
            }
          });

          return isSlashCommand;
        });

        // If we found and processed a slash command, also call clearSlashCommand
        // to remove the prompt block
        if (result) {
          // We need to do this with a small delay to ensure the transaction
          // above completes first
          setTimeout(() => {
            editor.commands.clearSlashCommand();
          }, 0);
          return true;
        }

        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },

  addCommands() {
    return {
      insertSlashCommand:
        (
          command: SlashCommandDescription,
          inputId: string = MAIN_EDITOR_INPUT_ID,
        ) =>
        ({ commands, chain }) => {
          if (!command.prompt) {
            return false;
          }

          const contextItem: ContextItemWithId = {
            content: command.prompt,
            name: command.name,
            description: command.description || "",
            id: {
              providerTitle: "prompt",
              itemId: command.name,
            },
          };

          // Create the document with both a prompt block and the slash command paragraph
          return chain()
            .setContent({
              type: "doc",
              content: [
                // First insert the prompt using the PromptExtension command
                {
                  type: PromptExtension.name,
                  attrs: {
                    item: contextItem,
                    inputId,
                  },
                },
                // Add the paragraph with the slash command
                {
                  type: "paragraph",
                  content: [
                    {
                      type: this.name,
                      attrs: {
                        id: command.name,
                        label: command.name,
                      },
                    },
                    {
                      type: "text",
                      text: " ",
                    },
                  ],
                },
              ],
            })
            .focus()
            .run();
        },

      clearSlashCommand:
        () =>
        ({ commands, state }) => {
          // First clear all prompt blocks using the PromptExtension command
          commands.clearPrompt();

          // Then find and remove all slash command nodes
          let found = false;
          const slashNodes: { pos: number; node: ProseMirrorNode }[] = [];

          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name) {
              slashNodes.push({ pos, node });
              found = true;
            }
            return true;
          });

          // Delete all found slash command nodes in reverse order
          for (let i = slashNodes.length - 1; i >= 0; i--) {
            const { pos, node } = slashNodes[i];
            commands.deleteRange({ from: pos, to: pos + node.nodeSize });
          }

          return found;
        },
    };
  },
});
