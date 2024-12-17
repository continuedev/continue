import {
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ContextItemWithId } from "core";
import { dedent, getMarkdownLanguageTagForFile } from "core/util";
import React, { useContext, useMemo } from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscEditorBackground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { getFontSize } from "../../util";
import FileIcon from "../FileIcon";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import StyledMarkdownPreview from "./StyledMarkdownPreview";
import { ctxItemToRifWithContents } from "core/commands/util";

const PreviewMarkdownDiv = styled.div<{
  borderColor?: string;
}>`
  background-color: ${vscEditorBackground};
  border-radius: ${defaultBorderRadius};
  border: 0.5px solid ${(props) => props.borderColor || lightGray};
  margin-top: 4px;
  margin-bottom: 4px;
  overflow: hidden;
  position: relative;

  & div {
    background-color: ${vscEditorBackground};
  }
`;

const PreviewMarkdownHeader = styled.div`
  margin: 0;
  padding: 2px 6px;
  border-bottom: 0.5px solid ${lightGray};
  word-break: break-all;
  font-size: ${getFontSize() - 3}px;
  display: flex;
  align-items: center;
`;

interface CodeSnippetPreviewProps {
  item: ContextItemWithId;
  onDelete?: () => void;
  borderColor?: string;
  hideHeader?: boolean;
}

const MAX_PREVIEW_HEIGHT = 300;

const backticksRegex = /`{3,}/gm;

function CodeSnippetPreview(props: CodeSnippetPreviewProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const [collapsed, setCollapsed] = React.useState(true);
  const [hovered, setHovered] = React.useState(false);

  const content = useMemo(() => {
    return dedent`${props.item.content}`;
  }, [props.item.content]);

  const fence = useMemo(() => {
    const backticks = content.match(backticksRegex);
    return backticks ? backticks.sort().at(-1) + "`" : "```";
  }, [content]);

  const codeBlockRef = React.useRef<HTMLDivElement>(null);

  return (
    <PreviewMarkdownDiv
      spellCheck={false}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      borderColor={props.borderColor}
      className="find-widget-skip"
    >
      {!props.hideHeader && (
        <PreviewMarkdownHeader
          className="flex cursor-pointer justify-between"
          onClick={() => {
            if (
              props.item.id.providerTitle === "file" &&
              props.item.uri?.value
            ) {
              ideMessenger.post("showFile", {
                filepath: props.item.uri.value,
              });
            } else if (props.item.id.providerTitle === "code") {
              const rif = ctxItemToRifWithContents(props.item, true);
              ideMessenger.ide.showLines(
                rif.filepath,
                rif.range.start.line,
                rif.range.end.line,
              );
            } else {
              ideMessenger.post("showVirtualFile", {
                content,
                name: props.item.name,
              });
            }
          }}
        >
          <div className="flex items-center gap-1">
            <FileIcon height="16px" width="16px" filename={props.item.name} />
            {props.item.name}
          </div>
          <div className="flex items-center gap-1">
            <HeaderButtonWithToolTip
              text="Delete"
              onClick={(e) => {
                e.stopPropagation();
                props.onDelete?.();
              }}
            >
              <XMarkIcon width="1em" height="1em" />
            </HeaderButtonWithToolTip>
          </div>
        </PreviewMarkdownHeader>
      )}
      <div
        contentEditable={false}
        className={`m-0 ${collapsed ? "overflow-hidden" : "overflow-auto"}`}
        ref={codeBlockRef}
        style={{
          maxHeight: collapsed ? MAX_PREVIEW_HEIGHT : undefined, // Could switch to max-h-[33vh] but then chevron icon shows when height can't change
        }}
      >
        <StyledMarkdownPreview
          source={`${fence}${getMarkdownLanguageTagForFile(props.item.name)} ${props.item.description}\n${content}\n${fence}`}
        />
      </div>

      {(codeBlockRef.current?.scrollHeight ?? 0) > MAX_PREVIEW_HEIGHT && (
        <HeaderButtonWithToolTip
          className="absolute bottom-1 right-2"
          text={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronDownIcon
              className="h-5 w-5"
              onClick={() => setCollapsed(false)}
            />
          ) : (
            <ChevronUpIcon
              className="h-5 w-5"
              onClick={() => setCollapsed(true)}
            />
          )}
        </HeaderButtonWithToolTip>
      )}
    </PreviewMarkdownDiv>
  );
}

export default CodeSnippetPreview;
