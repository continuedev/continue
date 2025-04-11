import { mergeAttributes, Node } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { MentionOptions } from "./types";

export const Mention = Node.create<MentionOptions>({
  name: "mention",

  addOptions() {
    return {
      HTMLAttributes: {
        class: "mention",
      },

      renderHTML({ options, node }) {
        return [
          "span",
          this.HTMLAttributes,
          `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`,
        ];
      },
      suggestion: {
        char: "@",
        pluginKey: new PluginKey(this.name),
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

          window.getSelection()?.collapseToEnd();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes[this.name];
          const allow = !!$from.parent.type.contentMatch.matchType(type);

          // Check if there's a space after the "@"
          const textFrom = range.from;
          const textTo = state.selection.$to.pos;
          const text = state.doc.textBetween(textFrom, textTo);
          const hasSpace = text.includes(" ");

          return allow && !hasSpace;
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

      renderInlineAs: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-renderInlineAs"),
        renderHTML: (attributes) => {
          if (typeof attributes.renderInlineAs !== "string") {
            return {};
          }

          return {
            "data-renderInlineAs": attributes.renderInlineAs,
          };
        },
      },

      query: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-query"),
        renderHTML: (attributes) => {
          if (!attributes.query) {
            return {};
          }

          return {
            "data-query": attributes.query,
          };
        },
      },

      itemType: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-itemType"),
        renderHTML: (attributes) => {
          if (!attributes.itemType) {
            return {};
          }

          return {
            "data-itemType": attributes.itemType,
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
    const html = this.options.renderHTML({
      options: this.options,
      node,
    });

    if (typeof html === "string") {
      return [
        "span",
        mergeAttributes(
          { "data-type": this.name },
          this.options.HTMLAttributes,
          HTMLAttributes,
        ),
        html,
      ];
    }
    return html;
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isMention = false;
          const { selection } = state;
          const { empty, anchor } = selection;

          if (!empty) {
            return false;
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isMention = true;
              tr.insertText(
                this.options.suggestion.char || "",
                pos,
                pos + node.nodeSize,
              );

              return false;
            }
          });

          return isMention;
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
