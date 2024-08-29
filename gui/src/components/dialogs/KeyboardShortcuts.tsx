import ReactDOM from "react-dom";
import styled from "styled-components";
import {
  StyledTooltip,
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscEditorBackground,
  vscForeground,
} from "..";
import { getPlatform, isJetBrains } from "../../util";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  grid-gap: 1.3rem;
  padding: 2rem;
  justify-items: center;
  align-items: center;
  overflow-y: auto;
`;

const StyledKeyDiv = styled.div`
  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 4px;
  color: ${vscForeground};

  width: 16px;
  height: 16px;

  display: flex;
  justify-content: center;
  align-items: center;
`;

const keyToName = {
  "CMD": "Cmd",
  "CTRL": "Ctrl",
  "SHIFT": "Shift",
  "ENTER": "Enter",
  "BACKSPACE": "Backspace",
  "ALT": "Option",
  "⎇": "ALT",
};

function KeyDiv({ text }: { text: string }) {
  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  return (
    <>
      <span className="monaco-keybinding-key leading-3 tracking-widest" data-tooltip-id={`header_button_${text}`}>
        {text}
      </span>
      {tooltipPortalDiv &&
        ReactDOM.createPortal(
          <StyledTooltip id={`header_button_${text}`} place="bottom">
            {keyToName[text]}
          </StyledTooltip>,
          tooltipPortalDiv,
        )}
    </>
  );
}

interface KeyboardShortcutProps {
  mac: string;
  windows: string;
  description: string;
}

function KeyboardShortcut(props: KeyboardShortcutProps) {
  const shortcut = getPlatform() === "mac" ? props.mac : props.windows;
  return (
    <ShortcutContainer>
      <span
        className="tracking-wide"
        style={{
          color: vscForeground,
        }}
      >
        {props.description}
      </span>
      <ShortcutKeys className="flex float-right monaco-keybinding">
        {shortcut.split(" ").map((key, i) => {
          return <KeyDiv key={i} text={key}></KeyDiv>;
        })}
      </ShortcutKeys>
    </ShortcutContainer>
  );
}

const ShortcutContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  @media (max-width: 400px) {
    flex-direction: column;
    align-items: flex-start;

    & > .monaco-keybinding {
      margin-top: 0.5rem;
    }
  }
`;

const ShortcutKeys = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

const vscodeShortcuts: KeyboardShortcutProps[] = [
  {
    mac: "CMD L",
    windows: "CTRL L",
    description: "New Session",
  },
  {
    mac: "CMD I",
    windows: "CTRL I",
    description: "Quick Edit Selected code",
  },
  {
    mac: "CMD \\",
    windows: "CTRL \\",
    description: "Big Chat",
  },
  {
    mac: "CMD :",
    windows: "CTRL :",
    description: "Close Chat",
  },
  {
    mac: "CMD O",
    windows: "CTRL O",
    description: "Open History",
  },
  {
    mac: "CMD SHIFT L",
    windows: "CTRL SHIFT L",
    description: "Append Code",
  },
  {
    mac: "CMD SHIFT ENTER",
    windows: "CTRL SHIFT ENTER",
    description: "Accept Diff",
  },
  {
    mac: "CMD SHIFT BACKSPACE",
    windows: "CTRL SHIFT BACKSPACE",
    description: "Reject Diff",
  },
  {
    mac: "CMD ALT Y",
    windows: "CTRL ALT Y",
    description: "Accept Top Change in Diff",
  },
  {
    mac: "CMD ALT N",
    windows: "CTRL ALT N",
    description: "Reject Top Change in Diff",
  },
  {
    mac: "CMD ALT L",
    windows: "CTRL ALT L",
    description: "Toggle PearAI Sidebar",
  },
  {
    mac: "CMD SHIFT R",
    windows: "CTRL SHIFT R",
    description: "Debug Terminal",
  },
  {
    mac: "CMD BACKSPACE",
    windows: "CTRL BACKSPACE",
    description: "Cancel response",
  },
  {
    mac: "CMD K CMD M",
    windows: "CTRL K CTRL M",
    description: "Toggle Full Screen",
  },
  {
    mac: "CMD '",
    windows: "CTRL '",
    description: "Toggle Selected Model",
  },
];

const jetbrainsShortcuts: KeyboardShortcutProps[] = [
  {
    mac: "CMD J",
    windows: "CTRL J",
    description: "Append Code + New Session",
  },
  {
    mac: "CMD SHIFT J",
    windows: "CTRL SHIFT J",
    description: "Select Code",
  },
  {
    mac: "CMD I",
    windows: "CTRL I",
    description: "Edit highlighted code",
  },
  {
    mac: "CMD SHIFT I",
    windows: "CTRL SHIFT I",
    description: "Toggle inline edit focus",
  },
  {
    mac: "CMD SHIFT ENTER",
    windows: "CTRL SHIFT ENTER",
    description: "Accept Diff",
  },
  {
    mac: "CMD SHIFT BACKSPACE",
    windows: "CTRL SHIFT BACKSPACE",
    description: "Reject Diff",
  },
  {
    mac: "ALT SHIFT J",
    windows: "ALT SHIFT J",
    description: "Quick Input",
  },
  {
    mac: "CMD ALT J",
    windows: "CTRL ALT J",
    description: "Toggle Sidebar",
  },
  {
    mac: "CMD BACKSPACE",
    windows: "CTRL BACKSPACE",
    description: "Cancel response",
  },
  {
    mac: "CMD '",
    windows: "CTRL '",
    description: "Toggle Selected Model",
  },
];

function KeyboardShortcutsDialog() {
  return (
    <div className="p-2">
      <GridDiv className="rounded-xl w-3/4 mx-auto" style={{
          backgroundColor: vscEditorBackground,
        }}>
      <h3 className="my-1 text-center mb-0">Keyboard Shortcuts</h3>
        {(isJetBrains() ? jetbrainsShortcuts : vscodeShortcuts).map(
          (shortcut, i) => {
            return (
              <KeyboardShortcut
                key={i}
                mac={shortcut.mac}
                windows={shortcut.windows}
                description={shortcut.description}
              />
            );
          },
        )}
      </GridDiv>
    </div>
  );
}

export default KeyboardShortcutsDialog;