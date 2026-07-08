import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { NodeViewProps } from "@tiptap/react";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../../../context/IdeMessenger";
import { ExpandableToolbarPreview } from "../../components/ExpandableToolbarPreview";
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

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ideMessenger.post("showVirtualFile", {
      content: item.content,
      name: item.name,
    });
  };

  const handleDelete = () => {
    editor.commands.clearPrompt();
  };

  return (
    <NodeViewWrapper>
      <ExpandableToolbarPreview
        initiallyHidden={false}
        isSelected={selected}
        title={item.name}
        icon={<ChatBubbleLeftIcon className="h-3 w-3 pl-1 pr-0.5" />}
        inputId={inputId}
        itemId={item.id.itemId}
        onDelete={handleDelete}
        onTitleClick={!item.content ? undefined : handleTitleClick}
      >
        {!item.content ? null : (
          <div
            className="whitespace-pre-wrap px-3 py-1 text-xs"
            contentEditable={false}
          >
            {item.content}
          </div>
        )}
      </ExpandableToolbarPreview>
    </NodeViewWrapper>
  );
};
