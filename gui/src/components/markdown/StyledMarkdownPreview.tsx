import { memo, useEffect } from "react";
import { useRemark } from "react-remark";
import rehypeShikiji from "rehype-shikiji";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";
import { getFontSize } from "../../util";
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

    border-radius: ${defaultBorderRadius};
    ${(props) => {
      if (props.showBorder) {
        return `
          border: 0.5px solid ${lightGray};
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
    color: #f78383;
    word-wrap: break-word;
    border-radius: ${defaultBorderRadius};
    background-color: ${vscEditorBackground};
    font-size: 12px;
  }

  background-color: ${vscBackground};
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
  padding-left: 8px;
  padding-right: 8px;
  color: ${vscForeground};

  p {
    line-height: 1.5;
  }
`;

interface StyledMarkdownPreviewProps {
  source?: string;
  maxHeight?: number;
  className?: string;
  showCodeBorder?: boolean;
}

const StyledMarkdownPreview = memo(function StyledMarkdownPreview(
  props: StyledMarkdownPreviewProps
) {
  const [reactContent, setMarkdownSource] = useRemark({
    rehypePlugins: [
      [
        rehypeShikiji as any,
        { theme: (window as any).fullColorTheme || "nord" },
      ],
    ],
    rehypeReactOptions: {
      components: {
        a: ({ node, ...props }) => {
          return (
            <a {...props} target="_blank">
              {props.children}
            </a>
          );
        },
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
