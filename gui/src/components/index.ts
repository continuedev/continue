import styled, { keyframes } from "styled-components";
import { getFontSize, isJetBrains } from "../util";

export const VSC_INPUT_BACKGROUND_VAR = "--vscode-input-background";
export const VSC_BACKGROUND_VAR = "--vscode-sideBar-background";
export const VSC_FOREGROUND_VAR = "--vscode-editor-foreground";
export const VSC_BUTTON_BACKGROUND_VAR = "--vscode-button-background";
export const VSC_BUTTON_FOREGROUND_VAR = "--vscode-button-foreground";
export const VSC_EDITOR_BACKGROUND_VAR = "--vscode-editor-background";
export const VSC_LIST_SELECTION_BACKGROUND_VAR =
  "--vscode-list-activeSelectionBackground";
export const VSC_FOCUS_BORDER = "--vscode-focus-border";
export const VSC_LIST_ACTIVE_FOREGROUND_VAR =
  "--vscode-quickInputList-focusForeground";
export const VSC_QUICK_INPUT_BACKGROUND_VAR = "--vscode-quickInput-background";
export const VSC_INPUT_BORDER_VAR = "--vscode-input-border";
export const VSC_INPUT_BORDER_FOCUS_VAR = "--vscode-focusBorder";
export const VSC_BADGE_BACKGROUND_VAR = "--vscode-badge-background";
export const VSC_BADGE_FOREGROUND_VAR = "--vscode-badge-foreground";
export const VSC_SIDEBAR_BORDER_VAR = "--vscode-sideBar-border";

export const VSC_THEME_COLOR_VARS = [
  VSC_INPUT_BACKGROUND_VAR,
  VSC_BACKGROUND_VAR,
  VSC_FOREGROUND_VAR,
  VSC_BUTTON_BACKGROUND_VAR,
  VSC_BUTTON_FOREGROUND_VAR,
  VSC_EDITOR_BACKGROUND_VAR,
  VSC_LIST_SELECTION_BACKGROUND_VAR,
  VSC_FOCUS_BORDER,
  VSC_LIST_ACTIVE_FOREGROUND_VAR,
  VSC_QUICK_INPUT_BACKGROUND_VAR,
  VSC_INPUT_BORDER_VAR,
  VSC_INPUT_BORDER_FOCUS_VAR,
  VSC_BADGE_BACKGROUND_VAR,
  VSC_SIDEBAR_BORDER_VAR,
  VSC_BADGE_FOREGROUND_VAR,
];

export const defaultBorderRadius = "5px";
export const lightGray = "#999998";
export const greenButtonColor = "#189e72";

export const vscInputBackground = `var(${VSC_INPUT_BACKGROUND_VAR}, rgb(45 45 45))`;
export const vscQuickInputBackground = `var(${VSC_QUICK_INPUT_BACKGROUND_VAR}, ${VSC_INPUT_BACKGROUND_VAR}, rgb(45 45 45))`;
export const vscBackground = `var(${VSC_BACKGROUND_VAR}, rgb(30 30 30))`;
export const vscForeground = `var(${VSC_FOREGROUND_VAR}, #fff)`;
export const vscButtonBackground = `var(${VSC_BUTTON_BACKGROUND_VAR}, #1bbe84)`;
export const vscButtonForeground = `var(${VSC_BUTTON_FOREGROUND_VAR}, #ffffff)`;
export const vscEditorBackground = `var(${VSC_EDITOR_BACKGROUND_VAR}, ${VSC_BACKGROUND_VAR}, rgb(30 30 30))`;
export const vscListActiveBackground = `var(${VSC_LIST_SELECTION_BACKGROUND_VAR}, #1bbe84)`;
export const vscFocusBorder = `var(${VSC_FOCUS_BORDER}, #1bbe84)`;
export const vscListActiveForeground = `var(${VSC_LIST_ACTIVE_FOREGROUND_VAR}, ${VSC_FOREGROUND_VAR})`;
export const vscInputBorder = `var(${VSC_INPUT_BORDER_VAR}, ${lightGray})`;
export const vscInputBorderFocus = `var(${VSC_INPUT_BORDER_FOCUS_VAR}, ${lightGray})`;
export const vscBadgeBackground = `var(${VSC_BADGE_BACKGROUND_VAR}, #1bbe84)`;
export const vscBadgeForeground = `var(${VSC_BADGE_FOREGROUND_VAR}, #fff)`;
export const vscSidebarBorder = `var(${VSC_SIDEBAR_BORDER_VAR}, transparent)`;

if (typeof document !== "undefined") {
  for (const colorVar of VSC_THEME_COLOR_VARS) {
    if (isJetBrains()) {
      const cached = localStorage.getItem(colorVar);
      if (cached) {
        document.body.style.setProperty(colorVar, cached);
      }
    }

    // Remove alpha channel from colors
    const value = getComputedStyle(document.documentElement).getPropertyValue(
      colorVar,
    );
    if (colorVar.startsWith("#") && value.length > 7) {
      document.body.style.setProperty(colorVar, value.slice(0, 7));
    }
  }
}

export function parseHexColor(hexColor: string): {
  r: number;
  g: number;
  b: number;
} {
  if (hexColor.startsWith("#")) {
    hexColor = hexColor.slice(1);
  }

  if (hexColor.length > 6) {
    hexColor = hexColor.slice(0, 6);
  }

  const r = parseInt(hexColor.substring(0, 2), 16);
  const g = parseInt(hexColor.substring(2, 4), 16);
  const b = parseInt(hexColor.substring(4, 6), 16);

  return { r, g, b };
}

export function parseColorForHex(colorVar: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    colorVar,
  );
  if (value.startsWith("#")) {
    return value.slice(0, 7);
  }

  // Parse rgb
  const rgb = value
    .slice(4, -1)
    .split(",")
    .map((x) => parseInt(x, 10));
  let hex =
    "#" +
    rgb
      .map((x) => x.toString(16))
      .map((x) => (x.length === 1 ? "0" + x : x))
      .join("");
  return hex;
}

export const Button = styled.button`
  padding: 10px 12px;
  margin: 8px 0;
  border-radius: ${defaultBorderRadius};

  border: none;
  color: ${vscBackground};
  background-color: ${vscForeground};

  &:disabled {
    color: ${vscBackground};
    opacity: 0.5;
    pointer-events: none;
  }

  &:hover:enabled {
    cursor: pointer;
    filter: brightness(1.2);
  }
`;

export const SecondaryButton = styled.button`
  padding: 10px 12px;
  margin: 8px 0;
  height: 2.5rem;
  border-radius: ${defaultBorderRadius};

  border: 1px solid ${vscForeground};
  color: ${vscForeground};
  background-color: inherit;

  &:disabled {
    color: gray;
  }

  &:hover:enabled {
    cursor: pointer;
    background-color: ${vscBackground};
    opacity: 0.9;
  }
`;

export const InputSubtext = styled.span`
  font-size: 0.75rem;
  line-height: 1rem;
  color: ${lightGray};
  margin-top: 0.25rem;
`;

export const ButtonSubtext = styled.span`
  display: block;
  margin-top: 0;
  text-align: center;
  color: ${lightGray};
  font-size: 0.75rem;
`;

export const CustomScrollbarDiv = styled.div`
  scrollbar-base-color: transparent;
  scrollbar-width: thin;
  background-color: ${vscBackground};

  & * {
    ::-webkit-scrollbar {
      width: 4px;
    }

    ::-webkit-scrollbar:horizontal {
      height: 4px;
    }

    ::-webkit-scrollbar-thumb {
      border-radius: 2px;
    }
  }
`;

export const TextArea = styled.textarea`
  padding: 8px;
  font-family: inherit;
  border-radius: ${defaultBorderRadius};
  margin: 16px auto;
  height: auto;
  width: calc(100% - 32px);
  background-color: ${vscInputBackground};
  color: ${vscForeground};
  z-index: 1;
  border: 1px solid transparent;

  resize: vertical;

  &:focus {
    outline: 1px solid ${lightGray};
    border: 1px solid transparent;
  }

  &::placeholder {
    color: ${lightGray}80;
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
  background-color: ${vscInputBackground};
  border-radius: ${defaultBorderRadius};
  padding: 4px 8px;
  width: fit-content;
`;

export const Hr = styled.hr`
  border: 0.5px solid ${lightGray};
`;

export const HelperText = styled.p`
  margin-top: 2.5px;
  font-size: ${getFontSize() - 2}px;
  color: ${lightGray};
`;

export const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  box-sizing: border-box;
  margin: 4px 0px;
  border-radius: ${defaultBorderRadius};
  outline: 1px solid ${lightGray};
  border: none;
  background-color: ${vscBackground};
  color: ${vscForeground};

  &:focus {
    background: ${vscInputBackground};
    outline: 1px solid ${lightGray};
  }

  &:invalid {
    outline: 1px solid red;
  }
`;

export const NumberInput = styled.input.attrs({ type: "number" })`
  padding: 8px 12px;
  margin: 8px 4px;
  box-sizing: border-box;
  border-radius: ${defaultBorderRadius};
  outline: 1px solid ${lightGray};
  border: none;
  background-color: ${vscBackground};
  color: ${vscForeground};

  &:focus {
    background: ${vscInputBackground};
  }
`;

export const Select = styled.select`
  padding: 8px 12px;
  margin: 8px 0;
  box-sizing: border-box;
  border-radius: ${defaultBorderRadius};
  outline: 1px solid ${lightGray};
  border: none;
  background-color: ${vscBackground};
  color: ${vscForeground};
`;

export const Label = styled.label<{ fontSize?: number }>`
  font-size: ${(props) => props.fontSize || getFontSize()}px;
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

export const HeaderButton = styled.button<{
  inverted: boolean | undefined;
  backgroundColor?: string;
  hoverBackgroundColor?: string;
}>`
  background-color: ${({ inverted, backgroundColor }) => {
    return backgroundColor ?? (inverted ? vscForeground : "transparent");
  }};
  color: ${({ inverted }) => (inverted ? vscBackground : vscForeground)};

  border: none;
  border-radius: ${defaultBorderRadius};
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};

  &:focus {
    outline: none;
    border: none;
  }

  &:hover {
    background-color: ${({ inverted, hoverBackgroundColor }) =>
      typeof inverted === "undefined" || inverted
        ? (hoverBackgroundColor ?? vscInputBackground)
        : "transparent"};
  }

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px;
`;

export const Divider = styled.div`
  height: 1px;
  background-color: ${lightGray};
`;

export const StyledActionButton = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background-color 200ms;
  border-radius: ${defaultBorderRadius};
  padding: 2px 12px;
  background-color: ${lightGray}33;
  background-opacity: 0.1;

  &:hover {
    background-color: ${lightGray}55;
  }
`;

export const CloseButton = styled.button`
  border: none;
  background-color: inherit;
  color: ${lightGray};
  position: absolute;
  top: 0.6rem;
  right: 1rem;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

export const AnimatedEllipsis = styled.span`
  &::after {
    content: ".";
    animation: ellipsis 2.5s infinite;
    display: inline-block;
    width: 12px;
    text-align: left;
  }

  @keyframes ellipsis {
    0% {
      content: ".";
    }
    33% {
      content: "..";
    }
    66% {
      content: "...";
    }
  }
`;
