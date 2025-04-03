import {
  NodeViewProps,
  NodeViewWrapper,
  NodeViewWrapperProps,
} from "@tiptap/react";
import { ContextItemWithId } from "core";
import { ctxItemToRifWithContents } from "core/commands/util";
import { dedent, getMarkdownLanguageTagForFile } from "core/util";
import { useContext, useMemo } from "react";
import { vscBadgeBackground } from "../../..";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppSelector } from "../../../../redux/hooks";
import FileIcon from "../../../FileIcon";
import StyledMarkdownPreview from "../../../markdown/StyledMarkdownPreview";
import { ExpandablePreview } from "./ExpandablePreview";

const backticksRegex = /`{3,}/gm;

/**
 * Component for displaying a code block in the TipTap editor
 */
export const CodeblockPreview = ({
  node,
  deleteNode,
  selected,
}: NodeViewProps) => {
  const item: ContextItemWithId = node.attrs.item;
  const inputId = node.attrs.inputId;
  const isFirstContextItem = false; // TODO: fix this, decided not worth the insane renders for now
  const ideMessenger = useContext(IdeMessengerContext);

  // Not setting this as a "p" will cause issues with foreign keyboards
  // See https://github.com/continuedev/continue/issues/3199
  const nodeViewWrapperTag: NodeViewWrapperProps["as"] = "p";

  const newestCodeblockForInputId = useAppSelector(
    (store) => store.session.newestCodeblockForInput[inputId],
  );

  const initiallyHidden = useMemo(() => {
    return newestCodeblockForInputId !== item.id.itemId;
  }, [newestCodeblockForInputId, item.id.itemId]);

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
      ideMessenger.ide.showLines(
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

  const borderColor = isFirstContextItem
    ? "#d0d"
    : selected
      ? vscBadgeBackground
      : undefined;

  return (
    <NodeViewWrapper
      className="code-block-with-content"
      as={nodeViewWrapperTag}
    >
      <ExpandablePreview
        title={item.name}
        icon={<FileIcon height="16px" width="16px" filename={item.name} />}
        initiallyHidden={initiallyHidden}
        onDelete={() => deleteNode()}
        borderColor={borderColor}
        onTitleClick={handleTitleClick}
      >
        <StyledMarkdownPreview
          source={`${fence}${getMarkdownLanguageTagForFile(item.name)} ${item.description}\n${content}\n${fence}`}
        />
      </ExpandablePreview>
    </NodeViewWrapper>
  );
};
