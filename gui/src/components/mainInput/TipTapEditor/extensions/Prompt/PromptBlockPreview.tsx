import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { NodeViewProps } from "@tiptap/react";
import { useContext, useMemo } from "react";
import { vscBadgeBackground } from "../../../..";
import { IdeMessengerContext } from "../../../../../context/IdeMessenger";
import { useAppSelector } from "../../../../../redux/hooks";
import { ExpandablePreview } from "../../components/ExpandablePreview";
import { NodeViewWrapper } from "../../components/NodeViewWrapper";
import { PromptBlockAttributes } from "./PromptBlock";

/**
 * Component for prompt blocks in the Tiptap editor
 */
export const PromptBlockPreview = ({
  node,
  selected,
  editor,
}: NodeViewProps) => {
  const { item, inputId } = node.attrs as PromptBlockAttributes;

  const ideMessenger = useContext(IdeMessengerContext);

  const newestCodeblockForInputId = useAppSelector(
    (store) => store.session.newestCodeblockForInput[inputId],
  );

  const initiallyHidden = useMemo(() => {
    return newestCodeblockForInputId !== item.id.itemId;
  }, [newestCodeblockForInputId, item.id.itemId]);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ideMessenger.post("showVirtualFile", {
      content: item.content,
      name: item.name,
    });
  };

  const handleDelete = () => {
    editor.commands.clearSlashCommand();
  };

  const borderColor = selected ? vscBadgeBackground : undefined;

  return (
    <NodeViewWrapper>
      <ExpandablePreview
        title={item.name}
        icon={<ChatBubbleLeftIcon className="h-3 w-3 pl-1 pr-0.5" />}
        initiallyHidden={initiallyHidden}
        onDelete={handleDelete}
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
