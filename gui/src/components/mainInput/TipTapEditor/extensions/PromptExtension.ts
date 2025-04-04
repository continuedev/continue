import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PromptBlockPreview } from "../toolbar-previews/PromptBlockPreview";

export interface PromptOptions {
  HTMLAttributes: Record<string, any>;
}

export const PROMPT_BLOCK_NAME = "prompt-block";

/**
 * Extension for adding prompt blocks to the Tiptap editor
 */
export const PromptExtension = Node.create<PromptOptions>({
  name: PROMPT_BLOCK_NAME,
  group: "block",

  addOptions() {
    return {
      HTMLAttributes: {},
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
});