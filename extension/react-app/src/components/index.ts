import { Tooltip } from "react-tooltip";
import styled, { keyframes } from "styled-components";

export const defaultBorderRadius = "5px";
export const lightGray = "rgb(100 100 100)";
// export const secondaryDark = "rgb(45 45 45)";
// export const vscBackground = "rgb(30 30 30)";
export const vscBackgroundTransparent = "#1e1e1ede";
export const buttonColor = "rgb(113 28 59)";
export const buttonColorHover = "rgb(113 28 59 0.67)";

export const secondaryDark = "var(--vscode-textBlockQuote-background)";
export const vscBackground = "var(--vscode-editor-background)";
export const vscForeground = "var(--vscode-editor-foreground)";

export const Button = styled.button`
  padding: 10px 12px;
  margin: 8px 0;
  border-radius: ${defaultBorderRadius};
  cursor: pointer;

  border: none;
  color: white;
  background-color: ${buttonColor};

  &:disabled {
    color: gray;
  }

  &:hover:enabled {
    background-color: ${buttonColorHover};
  }
`;

export const StyledTooltip = styled(Tooltip)`
  font-size: 12px;
  background-color: rgb(60 60 60);
  border-radius: ${defaultBorderRadius};
  padding: 6px;
  padding-left: 12px;
  padding-right: 12px;
  z-index: 100;
`;

export const TextArea = styled.textarea`
  width: 100%;
  border-radius: ${defaultBorderRadius};
  border: none;
  background-color: ${secondaryDark};
  resize: vertical;

  padding: 4px;
  caret-color: ${vscForeground};
  color: #{vscForeground};

  &:focus {
    outline: 1px solid ${buttonColor};
  }
`;

export const Pre = styled.pre`
  border-radius: ${defaultBorderRadius};
  padding: 8px;
  max-height: 150px;
  overflow-y: scroll;
  margin: 0;
  background-color: ${vscBackground};
  border: none;

  /* text wrapping */
  white-space: pre-wrap; /* Since CSS 2.1 */
  white-space: -moz-pre-wrap; /* Mozilla, since 1999 */
  white-space: -pre-wrap; /* Opera 4-6 */
  white-space: -o-pre-wrap; /* Opera 7 */
  word-wrap: break-word; /* Internet Explorer 5.5+ */
`;

export const H3 = styled.h3`
  background-color: ${secondaryDark};
  border-radius: ${defaultBorderRadius};
  padding: 4px 8px;
  width: fit-content;
`;

export const TextInput = styled.input.attrs({ type: "text" })`
  width: 100%;
  padding: 12px 20px;
  margin: 8px 0;
  box-sizing: border-box;
  border-radius: ${defaultBorderRadius};
  border: 2px solid gray;
`;

const spin = keyframes`
  from {
    -webkit-transform: rotate(0deg);
  }
  to {
    -webkit-transform: rotate(360deg);
  }
`;

export const Loader = styled.div`
  border: 4px solid transparent;
  border-radius: 50%;
  border-top: 4px solid white;
  width: 36px;
  height: 36px;
  -webkit-animation: ${spin} 1s ease-in-out infinite;
  animation: ${spin} 1s ease-in-out infinite;
  margin: auto;
`;

export const MainContainerWithBorder = styled.div<{ borderWidth?: string }>`
  border-radius: ${defaultBorderRadius};
  padding: ${(props) => props.borderWidth || "1px"};
  background-color: white;
`;

export const MainTextInput = styled.textarea`
  padding: 8px;
  font-size: 16px;
  border-radius: ${defaultBorderRadius};
  border: 1px solid #ccc;
  margin: 8px 8px;
  background-color: ${vscBackground};
  color: ${vscForeground};
  outline: 1px solid orange;
  resize: none;
`;

export const appear = keyframes`
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0px);
    }
`;

export const HeaderButton = styled.button<{ inverted: boolean | undefined }>`
  background-color: ${({ inverted }) =>
    inverted ? vscForeground : "transparent"};
  color: ${({ inverted }) => (inverted ? vscBackground : vscForeground)};

  border: none;
  border-radius: ${defaultBorderRadius};
  cursor: pointer;

  &:hover {
    background-color: ${({ inverted }) =>
      typeof inverted === "undefined" || inverted
        ? secondaryDark
        : "transparent"};
  }
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px;
`;
