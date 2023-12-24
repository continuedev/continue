import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { ContextItemWithId } from "core";
import CodeSnippetPreview from "../markdown/CodeSnippetPreview";

const CodeBlockComponent = ({ node, deleteNode }) => {
  const item: ContextItemWithId = node.attrs.item;
  return (
    <NodeViewWrapper className="code-block-with-content">
      <CodeSnippetPreview
        item={item}
        onDelete={() => {
          deleteNode();
        }}
      />
    </NodeViewWrapper>
  );
};

export default Node.create({
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
