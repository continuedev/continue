import {
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ContextItemWithId } from "core";
import { dedent, getMarkdownLanguageTagForFile } from "core/util";
import React, { useContext } from "react";
import styled from "styled-components";
import { defaultBorderRadius, lightGray, vscEditorBackground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { getFontSize } from "../../util";
import FileIcon from "../FileIcon";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
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
  font-size: ${getFontSize() - 3}px;
  display: flex;
  align-items: center;
`;

interface CodeSnippetPreviewProps {
  item: ContextItemWithId;
  onDelete?: () => void;
  borderColor?: string;
}

const MAX_PREVIEW_HEIGHT = 300;

// Pre-compile the regular expression outside of the function
const backticksRegex = /`{3,}/gm;

function CodeSnippetPreview(props: CodeSnippetPreviewProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const [collapsed, setCollapsed] = React.useState(true);
  const [hovered, setHovered] = React.useState(false);

  const content = dedent`${props.item.content}`;

  const fence = React.useMemo(() => {
    const backticks = content.match(backticksRegex);
    return backticks ? backticks.sort().at(-1) + "`" : "```";
  }, [props.item.content]);

  const codeBlockRef = React.useRef<HTMLDivElement>(null);

  return (
    <PreviewMarkdownDiv
      spellCheck={false}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      borderColor={props.borderColor}
      className="find-widget-skip"
    >
      <PreviewMarkdownHeader
        className="flex cursor-pointer justify-between"
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
              props.item.description.split(" ")[0],
              parseInt(lines[0]) - 1,
              parseInt(lines[1]) - 1,
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
      <div
        contentEditable={false}
        className={`m-0 ${collapsed ? "max-h-[33vh] overflow-hidden" : "overflow-auto"}`}
        ref={codeBlockRef}
      >
        <StyledMarkdownPreview
          source={`${fence}${getMarkdownLanguageTagForFile(
            props.item.description.split(" ")[0],
          )} ${props.item.description}\n${content}\n${fence}`}
          contextItems={[props.item]}
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
