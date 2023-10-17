import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { getFontSize } from "../util";

const StyledMarkdownPreviewComponent = styled(MarkdownPreview)<{
  light?: boolean;
  fontSize?: number;
  maxHeight?: number;
}>`
  pre {
    background-color: ${(props) =>
      props.light ? vscBackground : secondaryDark};
    border-radius: ${defaultBorderRadius};
    /* border: 0.5px solid ${lightGray}; */

    max-width: calc(100vw - 24px);
  }

  code {
    color: #f78383;
    word-wrap: break-word;
    border-radius: ${defaultBorderRadius};
    background-color: ${secondaryDark};
  }

  pre > code {
    background-color: ${(props) =>
      props.light ? vscBackground : secondaryDark};
    color: ${vscForeground};
    padding: 12px;

    ${(props) => {
      if (props.maxHeight) {
        return `
          max-height: ${props.maxHeight}px;
          overflow-y: auto;
        `;
      }
    }}
  }

  background-color: ${(props) => (props.light ? "transparent" : vscBackground)};
  font-family: "Lexend", sans-serif;
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  padding: 8px;
  color: ${vscForeground};
`;

interface StyledMarkdownPreviewProps {
  source?: string;
  maxHeight?: number;
  className?: string;
}

function StyledMarkdownPreview(props: StyledMarkdownPreviewProps) {
  return (
    <StyledMarkdownPreviewComponent
      components={{
        a: ({ node, ...props }) => {
          return (
            <a {...props} target="_blank">
              {props.children}
            </a>
          );
        },
      }}
      className={props.className}
      maxHeight={props.maxHeight}
      fontSize={getFontSize()}
      source={props.source || ""}
      wrapperElement={{
        "data-color-mode": "dark",
      }}
    />
  );
}

export default StyledMarkdownPreview;
