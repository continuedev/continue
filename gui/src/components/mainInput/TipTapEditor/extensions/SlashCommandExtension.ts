// Adapted from SlashCommand extension (@tiptap/extension-mention/src/mention.ts)

import { mergeAttributes, Node } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { ContextItemWithId, SlashCommandDescription } from "core";
import { v4 as uuidv4 } from "uuid";

export type SlashCommandOptions = {
  HTMLAttributes: Record<string, any>;
  renderText: (props: { node: ProseMirrorNode }) => string;
  suggestion: Omit<SuggestionOptions, "editor">;
};

export const SLASH_CMD_NAME = "slash-command";
export const SLASH_CMD_SUGGESTION_CHAR = "/";

export const SlashCommandPluginKey = new PluginKey(SLASH_CMD_NAME);

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

          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
                attrs: props,
              },
              {
                type: "text",
                text: " ",
              },
            ])
            .run();

          const promptId = uuidv4();

          // Create a generic "promptToPromptBlockExtension" fn
          // For here and in the conversation starters

          editor
            .chain()
            .focus()
            .insertContentAt(0, {
              type: "promptBlock",
              attrs: {
                item: {
                  content: props.content,
                  name: props.title,
                  description: props.description,
                  id: {
                    providerTitle: "prompt",
                    itemId: props.name,
                  },
                } as ContextItemWithId,
                inputId: promptId,
              },
            })
            .run();

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
});

/**
 * Creates a paragraph node containing a slash command reference
 * @param command The slash command description to create the reference from
 * @returns A node object representing the paragraph with slash command
 */
export const createParagraphNodeFromSlashCmdDescription = (
  command: SlashCommandDescription,
) => {
  return {
    type: "paragraph",
    content: [
      {
        type: SlashCommandExtension.name,
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
  };
};
