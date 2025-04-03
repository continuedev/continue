import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ContextItemWithId, SlashCommandDescription } from "core";
import { MAIN_EDITOR_INPUT_ID } from "../../../../pages/gui/Chat";
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
  //   atom: true,
  //   draggable: true,

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

/**
 * Creates a prompt block node from a slash command description
 * @param command The slash command description to create the block from
 * @param inputId Optional input ID, defaults to main editor input ID
 * @returns A node object representing the prompt block
 */
export const createPromptBlockNodeFromSlashCmdDescription = (
  command: SlashCommandDescription,
  inputId: string = MAIN_EDITOR_INPUT_ID,
) => {
  return {
    type: PromptExtension.name,
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
  };
};
