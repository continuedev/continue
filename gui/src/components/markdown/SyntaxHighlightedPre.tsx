import { useContext } from "react";
import styled from "styled-components";
import { defaultBorderRadius, vscForeground } from "..";
import { VscThemeContext } from "../../context/VscTheme";

const StyledPre = styled.pre<{ theme: any }>`
  & .hljs {
    color: ${vscForeground};
  }

  margin-top: 0;
  margin-bottom: 0;
  border-radius: 0 0 ${defaultBorderRadius} ${defaultBorderRadius} !important;

  ${(props) =>
    Object.keys(props.theme)
      .map((key, index) => {
        return `
      & ${key} {
        color: ${props.theme[key]};
      }
    `;
      })
      .join("")}
`;

export const SyntaxHighlightedPre = (props: any) => {
  const currentTheme = useContext(VscThemeContext);

  return <StyledPre {...props} theme={currentTheme} />;
};
