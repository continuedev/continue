import React, { memo, useEffect } from "react";
import { useRemark } from "react-remark";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";
import { getFontSize } from "../../util";
import { MonacoCodeBlock } from "./MonacoCodeBlock";
import PreWithToolbar from "./PreWithToolbar";
import "./markdown.css";

const StyledMarkdown = styled.div<{
  fontSize?: number;
  maxHeight?: number;
  showBorder?: boolean;
}>`
  pre {
    background-color: ${vscEditorBackground};
    border-radius: ${defaultBorderRadius};

    max-width: calc(100vw - 24px);
    overflow-x: scroll;

    font-size: 12px;

    ${(props) => {
      if (props.showBorder) {
        return `
          border: 0.5px solid #8888;
        `;
      }
    }}
    padding: ${(props) => (props.showBorder ? "12px" : "0px 2px")};
    ${(props) => {
      if (props.maxHeight) {
        return `
          max-height: ${props.maxHeight}px;
          overflow-y: auto;
        `;
      }
    }}
  }

  code {
    span.line:empty {
      display: none;
    }
    color: #f78383;
    word-wrap: break-word;
    border-radius: ${defaultBorderRadius};
    background-color: ${vscEditorBackground};
    font-size: 12px;
    font-family: var(--vscode-editor-font-family);
  }

  code:not(pre > code) {
    font-family: monospace;
  }

  background-color: ${vscBackground};
  font-family:
    var(--vscode-font-family),
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
  padding-left: 8px;
  padding-right: 8px;
  color: ${vscForeground};

  p,
  li,
  ol,
  ul {
    line-height: 1.5;
  }
`;

interface StyledMarkdownPreviewProps {
  source?: string;
  maxHeight?: number;
  className?: string;
  showCodeBorder?: boolean;
}

const FadeInWords: React.FC = (props: any) => {
  const { children, ...otherProps } = props;

  // Split the text into words
  const words = children
    .map((child) => {
      if (typeof child === "string") {
        return child.split(" ").map((word, index) => (
          <span className="fade-in-span" key={index}>
            {word}{" "}
          </span>
        ));
      } else {
        return <span className="fade-in-span">{child}</span>;
      }
    })
    .flat();

  return <p {...otherProps}>{words}</p>;
};

const StyledMarkdownPreview = memo(function StyledMarkdownPreview(
  props: StyledMarkdownPreviewProps
) {
  const [reactContent, setMarkdownSource] = useRemark({
    rehypeReactOptions: {
      components: {
        a: ({ node, ...props }) => {
          return (
            <a {...props} target="_blank">
              {props.children}
            </a>
          );
        },
        pre: ({ node, ...preProps }) => {
          const monacoEditor = (
            <MonacoCodeBlock
              showBorder={props.showCodeBorder}
              language={
                preProps.children?.[0]?.props?.className?.split("-")[1] ||
                "typescript"
              }
              preProps={preProps}
              codeString={
                preProps.children?.[0]?.props?.children?.[0].trim() || ""
              }
            />
          );
          return props.showCodeBorder ? (
            <PreWithToolbar>{monacoEditor}</PreWithToolbar>
          ) : (
            monacoEditor
          );
        },
        // p: ({ node, ...props }) => {
        //   return <FadeInWords {...props}></FadeInWords>;
        // },
      },
    },
  });

  useEffect(() => {
    setMarkdownSource(props.source || "");
  }, [props.source]);

  return (
    <StyledMarkdown
      maxHeight={props.maxHeight}
      fontSize={getFontSize()}
      showBorder={props.showCodeBorder}
    >
      {reactContent}
    </StyledMarkdown>
  );
});

export default StyledMarkdownPreview;
