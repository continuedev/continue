import { NodeViewWrapper } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { vscBadgeBackground } from "..";
import CodeSnippetPreview from "../markdown/CodeSnippetPreview";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/store";

export const CodeBlockComponent = (props: any) => {
  const { node, deleteNode, selected, editor, updateAttributes } = props;
  const item: ContextItemWithId = node.attrs.item;
  // const contextItems = useSelector(
  //   (store: RootState) =>
  //     store.state.history[store.state.history.length - 1].contextItems,
  // );
  // const isFirstContextItem = item.id === contextItems[0]?.id;
  const isFirstContextItem = false;

  return (
    <NodeViewWrapper className="code-block-with-content" as="p">
      <CodeSnippetPreview
        borderColor={
          isFirstContextItem
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
