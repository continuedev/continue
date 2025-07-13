import { mergeAttributes, Node } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { MAIN_EDITOR_INPUT_ID } from "../../../../../pages/gui/Chat";
import { ComboBoxItem } from "../../../types";
import { PromptBlockPreview } from "./PromptBlockPreview";

export interface PromptBlockOptions {
  HTMLAttributes: Record<string, any>;
}

export interface PromptBlockAttributes {
  item: ContextItemWithId;
  inputId: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    promptBlock: {
      /**
       * Insert a prompt block into the editor
       */
      insertPrompt: (
        item: Pick<ComboBoxItem, "title" | "content" | "description">,
      ) => ReturnType;

      /**
       * Clear all prompt blocks from the editor
       */
      clearPrompt: () => ReturnType;
    };
  }
}

/**
 * Extension for adding prompt blocks to the TipTap editor
 */
export const PromptBlock = Node.create<PromptBlockOptions>({
  name: "prompt-block",
  group: "block",
  content: "inline*",

  addOptions() {
    return {
      HTMLAttributes: {
        class: "prompt-block",
      },
    };
  },

  addAttributes() {
    return {
      item: {
        default: null,
      },
      inputId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "prompt-block",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["prompt-block", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PromptBlockPreview);
  },

  addCommands() {
    return {
      insertPrompt:
        (item) =>
        ({ chain }) => {
          const contextItem: ContextItemWithId = {
            content: item.content ?? "",
            name: item.title,
            description: item.description,
            id: {
              providerTitle: "prompt",
              itemId: item.title,
            },
          };

          return chain()
            .clearPrompt()
            .insertContentAt(0, {
              type: this.name,
              attrs: {
                item: contextItem,
                inputId: MAIN_EDITOR_INPUT_ID,
              },
            })
            .focus("end")
            .run();
        },

      // TODO: This could probably be greatly simplified with something along the lines of
      // `editor.commands.deleteNode(this.name)`, but was unable to get it working
      clearPrompt:
        () =>
        ({ state, commands }) => {
          // Find all prompt-block nodes in the document
          const promptNodes: { pos: number; node: ProseMirrorNode }[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name) {
              promptNodes.push({ pos, node });
              return false; // Don't descend into this node
            }
            return true;
          });

          // Delete all found prompt blocks
          // We process them in reverse order so that deleting one doesn't affect the position of others
          for (let i = promptNodes.length - 1; i >= 0; i--) {
            const { pos, node } = promptNodes[i];
            commands.deleteRange({ from: pos, to: pos + node.nodeSize });
          }

          // Return true if we deleted any nodes
          return promptNodes.length > 0;
        },
    };
  },
});
