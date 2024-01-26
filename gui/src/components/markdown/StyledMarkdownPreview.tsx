import MarkdownPreview from "@uiw/react-markdown-preview";
import React, { memo, useCallback } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";
import { getFontSize } from "../../util";
import LinkableCode from "./LinkableCode";

const StyledMarkdownPreviewComponent = styled(MarkdownPreview)<{
  light?: boolean;
  fontSize?: number;
  maxHeight?: number;
  showBorder?: boolean;
}>`
  pre {
    background-color: ${(props) =>
      props.light ? vscBackground : vscEditorBackground};
    border-radius: ${defaultBorderRadius};

    max-width: calc(100vw - 24px);
  }

  code {
    color: #f78383;
    word-wrap: break-word;
    border-radius: ${defaultBorderRadius};
    background-color: ${vscEditorBackground};
  }

  pre > code {
    background-color: ${vscEditorBackground};
    color: ${vscForeground};
    padding: ${(props) => (props.showBorder ? "12px" : "0px 2px")};

    border-radius: ${defaultBorderRadius};
    ${(props) => {
      if (props.showBorder) {
        return `
          border: 0.5px solid ${lightGray};
        `;
      }
    }}

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
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    "Open Sans",
    "Helvetica Neue",
    sans-serif;
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  padding: 8px;
  color: ${vscForeground};
`;

interface StyledMarkdownPreviewProps {
  source?: string;
  maxHeight?: number;
  className?: string;
  showCodeBorder?: boolean;
}

const MemoizedCode = React.memo(({ node, ...codeProps }: any) => {
  return <code {...codeProps}></code>;
});

const StyledMarkdownPreview = memo(function StyledMarkdownPreview(
  props: StyledMarkdownPreviewProps
) {
  const renderCode = useCallback(({ node, ...codeProps }) => {
    return codeProps.inline ? (
      <LinkableCode {...codeProps}></LinkableCode>
    ) : (
      <MemoizedCode {...codeProps}></MemoizedCode>
    );
  }, []);

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
        code: renderCode,
      }}
      className={props.className}
      maxHeight={props.maxHeight}
      fontSize={getFontSize()}
      source={props.source || ""}
      wrapperElement={{
        "data-color-mode": "dark",
      }}
      showBorder={props.showCodeBorder}
    />
  );
});

export default StyledMarkdownPreview;
