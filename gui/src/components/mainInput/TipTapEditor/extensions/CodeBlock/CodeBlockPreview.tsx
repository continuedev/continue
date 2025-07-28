import { NodeViewProps } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { ctxItemToRifWithContents } from "core/commands/util";
import { dedent, getMarkdownLanguageTagForFile } from "core/util";
import { useContext, useMemo } from "react";
import { vscBadgeBackground } from "../../../..";
import { IdeMessengerContext } from "../../../../../context/IdeMessenger";
import FileIcon from "../../../../FileIcon";
import StyledMarkdownPreview from "../../../../StyledMarkdownPreview";
import { ExpandableToolbarPreview } from "../../components/ExpandableToolbarPreview";
import { NodeViewWrapper } from "../../components/NodeViewWrapper";

const backticksRegex = /`{3,}/gm;

/**
 * Component for displaying a code block in the TipTap editor
 */
export const CodeBlockPreview = ({
  node,
  deleteNode,
  selected,
}: NodeViewProps) => {
  const item: ContextItemWithId = node.attrs.item;
  const inputId = node.attrs.inputId;
  const ideMessenger = useContext(IdeMessengerContext);

  const content = useMemo(() => {
    return dedent`${item.content}`;
  }, [item.content]);

  const fence = useMemo(() => {
    const backticks = content.match(backticksRegex);
    return backticks ? backticks.sort().at(-1) + "`" : "```";
  }, [content]);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (item.id.providerTitle === "file" && item.uri?.value) {
      ideMessenger.post("showFile", {
        filepath: item.uri.value,
      });
    } else if (item.id.providerTitle === "code") {
      const rif = ctxItemToRifWithContents(item, true);
      void ideMessenger.ide.showLines(
        rif.filepath,
        rif.range.start.line,
        rif.range.end.line,
      );
    } else {
      ideMessenger.post("showVirtualFile", {
        content: item.content,
        name: item.name,
      });
    }
  };

  return (
    <NodeViewWrapper>
      <ExpandableToolbarPreview
        isSelected={selected}
        title={item.name}
        icon={<FileIcon height="16px" width="16px" filename={item.name} />}
        inputId={inputId}
        itemId={item.id.itemId}
        onDelete={() => deleteNode()}
        borderColor={selected ? vscBadgeBackground : undefined}
        onTitleClick={handleTitleClick}
      >
        {!content ? null : (
          <StyledMarkdownPreview
            source={`${fence}${getMarkdownLanguageTagForFile(item.name)} ${item.description}\n${content}\n${fence}`}
          />
        )}
      </ExpandableToolbarPreview>
    </NodeViewWrapper>
  );
};
