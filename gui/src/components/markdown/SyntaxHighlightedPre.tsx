import { useContext } from "react";
import styled from "styled-components";
import { vscForeground } from "..";
import { VscThemeContext } from "../../App";

const StyledPre = styled.pre<{ theme: any }>`
  & .hljs {
    color: ${vscForeground};
  }

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
