import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockComponent } from "./CodeBlockComponent";

export const CodeBlockExtension = Node.create({
  name: "codeBlock",

  group: "block",

  content: "inline*",

  atom: true,

  selectable: true,

  parseHTML() {
    return [
      {
        tag: "code-block",
      },
    ];
  },

  addAttributes() {
    return {
      item: {
        default: "",
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return ["code-block", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
});
