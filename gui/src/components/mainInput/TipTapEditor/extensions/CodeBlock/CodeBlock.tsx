import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockPreview } from "./CodeBlockPreview";

export const CodeBlock = Node.create({
  name: "codeblock",

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
      inputId: {
        default: "",
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return ["code-block", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockPreview);
  },
});
