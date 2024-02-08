import React, { memo, useEffect } from "react";
import { useRemark } from "react-remark";
// import rehypeKatex from "rehype-katex";
// import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import styled from "styled-components";
import { visit } from "unist-util-visit";
import {
  defaultBorderRadius,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";
import { getFontSize } from "../../util";
import PreWithToolbar from "./PreWithToolbar";
import { SyntaxHighlightedPre } from "./SyntaxHighlightedPre";
import "./markdown.css";

const StyledMarkdown = styled.div<{
  fontSize?: number;
  showBorder?: boolean;
}>`
  pre {
    background-color: ${vscEditorBackground};
    border-radius: ${defaultBorderRadius};

    max-width: calc(100vw - 24px);
    overflow-x: scroll;
    overflow-y: hidden;

    ${(props) => {
      if (props.showBorder) {
        return `
          border: 0.5px solid #8888;
        `;
      }
    }}
    padding: ${(props) => (props.showBorder ? "12px" : "0px 2px")};
  }

  code {
    span.line:empty {
      display: none;
    }
    word-wrap: break-word;
    border-radius: ${defaultBorderRadius};
    background-color: ${vscEditorBackground};
    font-size: 12px;
    font-family: var(--vscode-editor-font-family);
  }

  code:not(pre > code) {
    font-family: monospace;
    color: #f78383;
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
  className?: string;
  showCodeBorder?: boolean;
  scrollLocked?: boolean;
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
    // remarkPlugins: [remarkMath],
    // rehypePlugins: [rehypeKatex as any, {}],
    remarkPlugins: [
      () => {
        return (tree) => {
          visit(tree, "code", (node: any) => {
            if (!node.lang) {
              node.lang === "javascript";
            } else if (node.lang.includes(".")) {
              node.lang = node.lang.split(".").slice(-1)[0];
            }
          });
        };
      },
    ],
    rehypePlugins: [rehypeHighlight as any, {}],
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
          return props.showCodeBorder ? (
            <PreWithToolbar>
              <SyntaxHighlightedPre {...preProps}></SyntaxHighlightedPre>
            </PreWithToolbar>
          ) : (
            <SyntaxHighlightedPre {...preProps}></SyntaxHighlightedPre>
          );
        },
        //   pre: ({ node, ...preProps }) => {
        //     const codeString =
        //       preProps.children?.[0]?.props?.children?.[0].trim() || "";
        //     const monacoEditor = (
        //       <MonacoCodeBlock
        //         showBorder={props.showCodeBorder}
        //         language={
        //           preProps.children?.[0]?.props?.className?.split("-")[1] ||
        //           "typescript"
        //         }
        //         preProps={preProps}
        //         codeString={codeString}
        //       />
        //     );
        //     return props.showCodeBorder ? (
        //       <PreWithToolbar copyvalue={codeString}>
        //         <SyntaxHighlightedPre {...preProps}></SyntaxHighlightedPre>
        //       </PreWithToolbar>
        //     ) : (
        //       <SyntaxHighlightedPre {...preProps}></SyntaxHighlightedPre>
        //     );
        //   },
        //   // p: ({ node, ...props }) => {
        //   //   return <FadeInWords {...props}></FadeInWords>;
        //   // },
      },
    },
  });

  useEffect(() => {
    setMarkdownSource(props.source || "");
  }, [props.source]);

  return (
    <StyledMarkdown fontSize={getFontSize()} showBorder={props.showCodeBorder}>
      {reactContent}
    </StyledMarkdown>
  );
});

export default StyledMarkdownPreview;
