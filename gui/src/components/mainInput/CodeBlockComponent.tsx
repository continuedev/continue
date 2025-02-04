import { NodeViewWrapper, NodeViewWrapperProps } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { vscBadgeBackground } from "..";
import CodeSnippetPreview from "../markdown/CodeSnippetPreview";

export const CodeBlockComponent = (props: any) => {
  const { node, deleteNode, selected, editor, updateAttributes } = props;
  const item: ContextItemWithId = node.attrs.item;
  const inputId = node.attrs.inputId;
  // const contextItems = useSelector(
  //   (store: RootState) =>
  //     store.session.messages[store.session.messages.length - 1].contextItems,
  // );
  // const isFirstContextItem = item.id === contextItems[0]?.id;
  const isFirstContextItem = false; // TODO: fix this, decided not worth the insane renders for now

  // Not setting this as a "p" will cause issues with foreign keyboards
  // See https://github.com/continuedev/continue/issues/3199
  const nodeViewWrapperTag: NodeViewWrapperProps["as"] = "p";

  return (
    <NodeViewWrapper
      className="code-block-with-content"
      as={nodeViewWrapperTag}
    >
      <CodeSnippetPreview
        inputId={inputId}
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
