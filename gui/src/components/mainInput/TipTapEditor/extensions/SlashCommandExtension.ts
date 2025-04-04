// Adapted from SlashCommand extension (@tiptap/extension-mention/src/mention.ts)

import { mergeAttributes, Node } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { ContextItemWithId, SlashCommandDescription } from "core";
import { MAIN_EDITOR_INPUT_ID } from "../../../../pages/gui/Chat";
import { ComboBoxItem } from "../../types";
import { PROMPT_BLOCK_NAME } from "./PromptExtension";

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
       * @param inputId The input ID (defaults to MAIN_EDITOR_INPUT_ID)
       */
      insertSlashCommand: (
        command: SlashCommandDescription,
        inputId?: string,
      ) => ReturnType;
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
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
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
        }),
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
        ({ chain }) => {
          // Create the document with both a prompt block and the slash command paragraph
          return chain()
            .setContent({
              type: "doc",
              content: [
                // Add the prompt block at the beginning
                {
                  type: PROMPT_BLOCK_NAME,
                  attrs: {
                    item: {
                      content: command.prompt,
                      name: command.name,
                      description: command.description || "",
                      id: {
                        providerTitle: "prompt",
                        itemId: command.name,
                      },
                    } as ContextItemWithId,
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
    };
  },
});
