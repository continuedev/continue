import { mergeAttributes, Node } from "@tiptap/core";
import {
  NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { PaperClipIcon } from "@heroicons/react/24/outline";

export const FileAttachment = Node.create({
  name: "file-attachment",

  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: null,
      },
      dataUrl: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-file-attachment]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-file-attachment": "" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView);
  },
});

function FileAttachmentView(props: NodeViewProps) {
  const { name, dataUrl } = props.node.attrs;

  return (
    <NodeViewWrapper
      as="span"
      className="file-attachment"
      contentEditable={false}
      data-file-attachment
    >
      <a href={dataUrl} download={name} title={name} onClick={(e) => e.stopPropagation()}>
        <PaperClipIcon className="file-attachment-icon" />
        <span>{name}</span>
      </a>
    </NodeViewWrapper>
  );
}
