import { useContext } from "react";
import styled from "styled-components";
import { defaultBorderRadius, vscForeground } from "..";
import { VscThemeContext } from "../../context/VscTheme";

const generateThemeStyles = (theme: any) => {
  return Object.keys(theme)
    .map((key) => {
      return `
        & ${key} {
          color: ${theme[key]};
        }
      `;
    })
    .join("");
};

const StyledPre = styled.pre<{ theme: any; hasHeader?: boolean }>`
  & .hljs {
    color: ${vscForeground};
  }

  margin-top: 0;
  margin-bottom: 0;
  border-radius: ${(props) =>
    props.hasHeader
      ? `0 0 ${defaultBorderRadius} ${defaultBorderRadius}`
      : defaultBorderRadius} !important;

  ${(props) => generateThemeStyles(props.theme)}
`;

export const SyntaxHighlightedPre = (props: any) => {
  const currentTheme = useContext(VscThemeContext);
  // Check if this pre is inside a container with header by looking for parent with border
  const hasHeader = props.className?.includes("has-toolbar-header") ?? true;
  return (
    <StyledPre {...props} theme={currentTheme.theme} hasHeader={hasHeader} />
  );
};
