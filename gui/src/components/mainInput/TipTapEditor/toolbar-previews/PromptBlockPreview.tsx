import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { NodeViewWrapper, NodeViewWrapperProps } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { useContext, useMemo } from "react";
import { vscBadgeBackground } from "../../..";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppSelector } from "../../../../redux/hooks";
import { ExpandablePreview } from "./ExpandablePreview";

/**
 * Component for prompt blocks in the Tiptap editor
 */
export const PromptBlockPreview = (props: any) => {
  const { node, deleteNode, selected } = props;
  const item: ContextItemWithId = node.attrs.item;
  const inputId = node.attrs.inputId;
  const ideMessenger = useContext(IdeMessengerContext);

  // Not setting this as a "p" will cause issues with foreign keyboards
  const nodeViewWrapperTag: NodeViewWrapperProps["as"] = "p";

  const newestCodeblockForInputId = useAppSelector(
    (store) => store.session.newestCodeblockForInput[inputId],
  );

  const initiallyHidden = useMemo(() => {
    return newestCodeblockForInputId !== item.id.itemId;
  }, [newestCodeblockForInputId, item.id.itemId]);

  console.log({ id: item.id.itemId, newestCodeblockForInputId });

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ideMessenger.post("showVirtualFile", {
      content: item.content,
      name: item.name,
    });
  };

  const borderColor = selected ? vscBadgeBackground : undefined;

  return (
    <NodeViewWrapper
      className="prompt-block-with-content"
      as={nodeViewWrapperTag}
    >
      <ExpandablePreview
        title={item.name}
        icon={<ChatBubbleLeftIcon className="h-3 w-3 pl-1 pr-0.5" />}
        initiallyHidden={initiallyHidden}
        onDelete={() => deleteNode()}
        borderColor={borderColor}
        onTitleClick={handleTitleClick}
      >
        <div className="whitespace-pre-wrap px-3 py-1 text-xs">
          {item.content}
        </div>
      </ExpandablePreview>
    </NodeViewWrapper>
  );
};
