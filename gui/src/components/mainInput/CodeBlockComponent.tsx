import { NodeViewWrapper } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { useDispatch, useSelector } from "react-redux";
import { vscBadgeBackground } from "..";
import { RootState } from "../../redux/store";
import CodeSnippetPreview from "../markdown/CodeSnippetPreview";

export const CodeBlockComponent = ({
  node,
  deleteNode,
  selected,
  editor,
  updateAttributes,
}: any) => {
  const dispatch = useDispatch();
  const item: ContextItemWithId = node.attrs.item;

  const contextItems = useSelector(
    (state: RootState) => state.state.contextItems,
  );
  return (
    <NodeViewWrapper className="code-block-with-content" as="p">
      <CodeSnippetPreview
        borderColor={
          item.id === contextItems[0]?.id
            ? "#d0d"
            : selected
              ? vscBadgeBackground
              : undefined
        }
        item={item}
        onDelete={() => {
          deleteNode();
        }}
      />
    </NodeViewWrapper>
  );
};
