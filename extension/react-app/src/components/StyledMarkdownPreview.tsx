import styled from "styled-components";
import {
  defaultBorderRadius,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import MarkdownPreview from "@uiw/react-markdown-preview";

const StyledMarkdownPreview = styled(MarkdownPreview)<{ light?: boolean }>`
  pre {
    background-color: ${(props) =>
      props.light ? vscBackground : secondaryDark};
    padding: 1px;
    border-radius: ${defaultBorderRadius};
    border: 0.5px solid white;
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
  }

  background-color: ${(props) => (props.light ? "transparent" : vscBackground)};
  font-family: "Lexend", sans-serif;
  font-size: 13px;
  padding: 8px;
  color: ${vscForeground};
`;

export default StyledMarkdownPreview;
