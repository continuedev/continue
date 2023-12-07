import React from "react";
import { defaultBorderRadius, lightGray, secondaryDark } from "..";
import styled from "styled-components";
import { getFontSize, getMarkdownLanguageTagForFile } from "../../util";
import FileIcon from "../FileIcon";
import HeaderButtonWithText from "../HeaderButtonWithText";
import { ContextItem } from "../../../../core/llm/types";
import { postToIde } from "../../util/ide";
import {
  ArrowUpLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { deleteContextWithIds } from "../../redux/slices/sessionStateReducer";
import { useDispatch } from "react-redux";
import StyledMarkdownPreview from "./StyledMarkdownPreview";

const PreviewMarkdownDiv = styled.div<{ scroll: boolean }>`
  padding: 0px;
  background-color: ${secondaryDark};
  border-radius: ${defaultBorderRadius};
  margin: 8px;
  overflow: hidden;
  position: relative;

  & div {
    background-color: ${secondaryDark};
  }

  & code {
    overflow: ${(props) => (props.scroll ? "scroll" : "hidden")} !important;
  }
`;

const PreviewMarkdownHeader = styled.p`
  margin: 0;
  padding: 4px 8px;
  border-bottom: 1px solid ${lightGray};
  word-break: break-all;
  font-size: ${getFontSize()}px;
  display: flex;
  align-items: center;
`;

interface CodeSnippetPreviewProps {
  item: ContextItem;
  index: number;
}

function CodeSnippetPreview(props: CodeSnippetPreviewProps) {
  const dispatch = useDispatch();

  const [scrollLocked, setScrollLocked] = React.useState(true);
  const [hovered, setHovered] = React.useState(false);

  return (
    <PreviewMarkdownDiv
      scroll={!scrollLocked}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
            postToIde("showLines", {
              filepath: props.item.description,
              start: parseInt(lines[0]) - 1,
              end: parseInt(lines[1]) - 1,
            });
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
          <HeaderButtonWithText
            text="Delete"
            onClick={() => {
              dispatch(
                deleteContextWithIds({
                  ids: [props.item.id],
                  index: props.index,
                })
              );
            }}
          >
            <TrashIcon width="1.2em" height="1.2em" />
          </HeaderButtonWithText>
        </div>
      </PreviewMarkdownHeader>
      <pre className="m-0">
        <StyledMarkdownPreview
          source={`\`\`\`${getMarkdownLanguageTagForFile(
            props.item.description
          )}\n${props.item.content}\n\`\`\``}
          maxHeight={200}
        />
      </pre>

      {hovered && (
        <HeaderButtonWithText
          className="bottom-1 right-1 absolute"
          text={scrollLocked ? "Scroll" : "Lock Scroll"}
        >
          {scrollLocked ? (
            <ChevronUpIcon
              width="1.2em"
              height="1.2em"
              onClick={() => setScrollLocked(false)}
            />
          ) : (
            <ChevronDownIcon
              width="1.2em"
              height="1.2em"
              onClick={() => setScrollLocked(true)}
            />
          )}
        </HeaderButtonWithText>
      )}
    </PreviewMarkdownDiv>
  );
}

export default CodeSnippetPreview;
