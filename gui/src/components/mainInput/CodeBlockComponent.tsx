import { NodeViewWrapper } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { vscBadgeBackground } from "..";
import CodeSnippetPreview from "../markdown/CodeSnippetPreview";

export const CodeBlockComponent = (props: any) => {
  const { node, deleteNode, selected, editor, updateAttributes } = props;
  const item: ContextItemWithId = node.attrs.item;
  // const contextItems = useSelector(
  //   (store: RootState) =>
  //     store.session.messages[store.session.messages.length - 1].contextItems,
  // );
  // const isFirstContextItem = item.id === contextItems[0]?.id;
  const isFirstContextItem = false; // TODO: fix this, decided not worth the insane renders for now

  return (
    <NodeViewWrapper className="code-block-with-content" as="div">
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
