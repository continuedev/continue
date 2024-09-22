import {
  ChevronDownIcon,
  ChevronUpIcon,
  PaintBrushIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ContextItemWithId } from "core";
import { getMarkdownLanguageTagForFile } from "core/util";
import React, { useContext } from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscEditorBackground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { getFontSize } from "../../util";
import ButtonWithTooltip from "../ButtonWithTooltip";
import FileIcon from "../FileIcon";
import StyledMarkdownPreview from "./StyledMarkdownPreview";

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
  font-size: ${getFontSize() - 2}px;
  display: flex;
  align-items: center;
`;

interface CodeSnippetPreviewProps {
  item: ContextItemWithId;
  onDelete?: () => void;
  onEdit?: () => void;
  borderColor?: string;
  editing?: boolean;
}

const StyledHeaderButtonWithText = styled(ButtonWithTooltip)<{
  color?: string;
}>`
  ${(props) => props.color && `background-color: ${props.color};`}
`;

const MAX_PREVIEW_HEIGHT = 300;

// Pre-compile the regular expression outside of the function
const backticksRegex = /`{3,}/gm;

function CodeSnippetPreview(props: CodeSnippetPreviewProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const [collapsed, setCollapsed] = React.useState(true);
  const [hovered, setHovered] = React.useState(false);

  const fence = React.useMemo(() => {
    const backticks = props.item.content.match(backticksRegex);
    return backticks ? backticks.sort().at(-1) + "`" : "```";
  }, [props.item.content]);

  const codeBlockRef = React.useRef<HTMLDivElement>(null);
  const codeBlockHeight = `${Math.min(
    MAX_PREVIEW_HEIGHT,
    codeBlockRef.current?.scrollHeight ??
      // Best estimate of height I currently could find
      props.item.content.split("\n").length * 18 + 36,
  )}px`;

  return (
    <PreviewMarkdownDiv
      spellCheck={false}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      borderColor={props.borderColor}
    >
      <PreviewMarkdownHeader
        className="flex justify-between cursor-pointer"
        onClick={() => {
          if (props.item.id.providerTitle === "file") {
            ideMessenger.post("showFile", {
              filepath: props.item.description,
            });
          } else if (props.item.id.providerTitle === "code") {
            const lines = props.item.name
              .split("(")[1]
              .split(")")[0]
              .split("-");
            ideMessenger.ide.showLines(
              props.item.description,
              parseInt(lines[0]) - 1,
              parseInt(lines[1]) - 1,
            );
          } else {
            ideMessenger.post("showVirtualFile", {
              name: props.item.name,
              content: props.item.content,
            });
          }
        }}
      >
        <div className="flex items-center">
          <FileIcon height="20px" width="20px" filename={props.item.name} />
          {props.item.name}
        </div>
        <div className="flex items-center">
          {props.onEdit && (
            <StyledHeaderButtonWithText
              text="Edit"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                props.onEdit?.();
              }}
              {...(props.editing && { color: "#f0f4" })}
            >
              <PaintBrushIcon width="1.1em" height="1.1em" />
            </StyledHeaderButtonWithText>
          )}
          <ButtonWithTooltip
            text="Delete"
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete?.();
            }}
          >
            <XMarkIcon width="1.1em" height="1.1em" />
          </ButtonWithTooltip>
        </div>
      </PreviewMarkdownHeader>
      <div
        contentEditable={false}
        className="m-0"
        ref={codeBlockRef}
        style={{
          height: collapsed ? codeBlockHeight : undefined,
          overflow: collapsed ? "hidden" : "auto",
        }}
      >
        <StyledMarkdownPreview
          source={`${fence}${getMarkdownLanguageTagForFile(
            props.item.description,
          )}\n${props.item.content.trimEnd()}\n${fence}`}
          showCodeBorder={false}
        />
      </div>

      {(codeBlockRef.current?.scrollHeight ?? 0) > MAX_PREVIEW_HEIGHT && (
        <ButtonWithTooltip
          className="bottom-1 right-1 absolute"
          text={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronDownIcon
              width="1.2em"
              height="1.2em"
              onClick={() => setCollapsed(false)}
            />
          ) : (
            <ChevronUpIcon
              width="1.2em"
              height="1.2em"
              onClick={() => setCollapsed(true)}
            />
          )}
        </ButtonWithTooltip>
      )}
    </PreviewMarkdownDiv>
  );
}

export default CodeSnippetPreview;
