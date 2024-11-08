import { useContext } from "react";
import styled from "styled-components";
import { vscForeground, defaultBorderRadius } from "..";
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

const StyledPre = styled.pre<{ theme: any }>`
  & .hljs {
    color: ${vscForeground};
  }

  margin-top: 0;
  margin-bottom: 0;
  border-radius: 0 0 ${defaultBorderRadius} ${defaultBorderRadius} !important;

  ${(props) => generateThemeStyles(props.theme)}
`;

export const SyntaxHighlightedPre = () => {
  const currentTheme = useContext(VscThemeContext);
  return <StyledPre theme={currentTheme} />;
};
