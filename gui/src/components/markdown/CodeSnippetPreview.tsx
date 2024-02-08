import {
  ChevronDownIcon,
  ChevronUpIcon,
  PaintBrushIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ContextItemWithId } from "core";
import { ExtensionIde } from "core/ide";
import { getMarkdownLanguageTagForFile } from "core/util";
import React from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscEditorBackground } from "..";
import { getFontSize } from "../../util";
import { postToIde } from "../../util/ide";
import FileIcon from "../FileIcon";
import HeaderButtonWithText from "../HeaderButtonWithText";
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

const StyledHeaderButtonWithText = styled(HeaderButtonWithText)<{
  color?: string;
}>`
  ${(props) => props.color && `background-color: ${props.color};`}
`;

const MAX_PREVIEW_HEIGHT = 300;

// Pre-compile the regular expression outside of the function
const backticksRegex = /`{3,}/gm;

function CodeSnippetPreview(props: CodeSnippetPreviewProps) {
  const [collapsed, setCollapsed] = React.useState(true);
  const [hovered, setHovered] = React.useState(false);

  const fence = React.useMemo(() => {
    const backticks = props.item.content.match(backticksRegex);
    return backticks ? backticks.sort().at(-1) + "`" : "```";
  }, [props.item.content]);

  const codeBlockRef = React.useRef<HTMLDivElement>(null);

  return (
    <PreviewMarkdownDiv
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      borderColor={props.borderColor}
    >
      <PreviewMarkdownHeader
        className="flex justify-between cursor-pointer"
        onClick={() => {
          if (props.item.id.providerTitle === "file") {
            postToIde("showFile", {
              filepath: props.item.description,
            });
          } else if (props.item.id.providerTitle === "code") {
            const lines = props.item.name
              .split("(")[1]
              .split(")")[0]
              .split("-");
            new ExtensionIde().showLines(
              props.item.description,
              parseInt(lines[0]) - 1,
              parseInt(lines[1]) - 1
            );
          } else {
            postToIde("showVirtualFile", {
              name: props.item.name,
              content: props.item.content,
            });
          }
        }}
      >
        <div className="flex items-center">
          <FileIcon
            height="20px"
            width="20px"
            filename={props.item.name}
          ></FileIcon>
          {props.item.name}
        </div>
        <div className="flex items-center">
          {props.onEdit && (
            <StyledHeaderButtonWithText
              text="Edit"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                props.onEdit();
              }}
              {...(props.editing && { color: "#f0f4" })}
            >
              <PaintBrushIcon width="1.1em" height="1.1em" />
            </StyledHeaderButtonWithText>
          )}
          <HeaderButtonWithText
            text="Delete"
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete();
            }}
          >
            <XMarkIcon width="1.1em" height="1.1em" />
          </HeaderButtonWithText>
        </div>
      </PreviewMarkdownHeader>
      <div
        className="m-0"
        ref={codeBlockRef}
        style={{
          height: collapsed
            ? `${Math.min(
                MAX_PREVIEW_HEIGHT,
                codeBlockRef.current?.scrollHeight
              )}px`
            : undefined,
          overflow: collapsed ? "hidden" : "auto",
        }}
      >
        <StyledMarkdownPreview
          source={`${fence}${getMarkdownLanguageTagForFile(
            props.item.description
          )}\n${props.item.content}\n${fence}`}
          showCodeBorder={false}
        />
      </div>

      {codeBlockRef.current?.scrollHeight > MAX_PREVIEW_HEIGHT && (
        <HeaderButtonWithText
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
        </HeaderButtonWithText>
      )}
    </PreviewMarkdownDiv>
  );
}

export default CodeSnippetPreview;
