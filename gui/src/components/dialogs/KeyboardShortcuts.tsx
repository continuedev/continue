import ReactDOM from "react-dom";
import styled from "styled-components";
import {
  StyledTooltip,
  defaultBorderRadius,
  lightGray,
  vscForeground,
} from "..";
import { getPlatform } from "../../util";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-gap: 2rem;
  padding: 1rem;
  justify-items: center;
  align-items: center;

  border-top: 0.5px solid ${lightGray};
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
  "⌘": "Cmd",
  "⌃": "Ctrl",
  "⇧": "Shift",
  "⏎": "Enter",
  "⌫": "Backspace",
  "⌥": "Option",
};

function KeyDiv({ text }: { text: string }) {
  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  return (
    <>
      <StyledKeyDiv data-tooltip-id={`header_button_${text}`}>
        {text}
      </StyledKeyDiv>
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
  const shortcut = getPlatform() === "windows" ? props.windows : props.mac;
  return (
    <div className="flex justify-between w-full items-center">
      <span
        style={{
          color: vscForeground,
        }}
      >
        {props.description}
      </span>
      <div className="flex gap-2 float-right">
        {shortcut.split(" ").map((key) => {
          return <KeyDiv text={key}></KeyDiv>;
        })}
      </div>
    </div>
  );
}

const vscodeShortcuts: KeyboardShortcutProps[] = [
  {
    mac: "⌘ L",
    windows: "⌃ L",
    description: "Select Code + New Session",
  },
  {
    mac: "⌘ I",
    windows: "⌃ I",
    description: "Edit highlighted code",
  },
  {
    mac: "⌘ ⇧ L",
    windows: "⌃ ⇧ L",
    description: "Select Code",
  },
  {
    mac: "⌘ ⇧ ⏎",
    windows: "⌃ ⇧ ⏎",
    description: "Accept Diff",
  },
  {
    mac: "⌘ ⇧ ⌫",
    windows: "⌃ ⇧ ⌫",
    description: "Reject Diff",
  },
  {
    mac: "⌥ ⌘ M",
    windows: "⌥ ⌃ M",
    description: "Toggle Auxiliary Bar",
  },
  {
    mac: "⌘ ⇧ R",
    windows: "⌃ ⇧ R",
    description: "Debug Terminal",
  },
  {
    mac: "⌘ ⌫",
    windows: "⌃ ⌫",
    description: "Cancel response",
  },
  {
    mac: "⌘ K ⌘ M",
    windows: "⌃ K ⌃ M",
    description: "Toggle Full Screen",
  },
  {
    mac: "⌘ '",
    windows: "⌃ '",
    description: "Toggle Selected Model",
  },
];

const jetbrainsShortcuts: KeyboardShortcutProps[] = [
  {
    mac: "⌘ J",
    windows: "⌃ J",
    description: "Select Code + New Session",
  },
  {
    mac: "⌘ ⇧ J",
    windows: "⌃ ⇧ J",
    description: "Select Code",
  },
  {
    mac: "⌘ ⇧ ⏎",
    windows: "⌃ ⇧ ⏎",
    description: "Accept Diff",
  },
  {
    mac: "⌘ ⇧ ⌫",
    windows: "⌃ ⇧ ⌫",
    description: "Reject Diff",
  },
  {
    mac: "⌥ ⇧ J",
    windows: "⌥ ⇧ J",
    description: "Quick Input",
  },
  {
    mac: "⌥ ⌘ J",
    windows: "⌥ ⌃ J",
    description: "Toggle Sidebar",
  },
  {
    mac: "⌘ ⌫",
    windows: "⌃ ⌫",
    description: "Cancel respoonse",
  },
  {
    mac: "⌘ '",
    windows: "⌃ '",
    description: "Toggle Selected Model",
  },
];

function KeyboardShortcutsDialog() {
  return (
    <div className="p-2">
      <h3 className="my-3 mx-auto text-center">Keyboard Shortcuts</h3>
      <GridDiv>
        {(localStorage.getItem("ide") === "jetbrains"
          ? jetbrainsShortcuts
          : vscodeShortcuts
        ).map((shortcut) => {
          return (
            <KeyboardShortcut
              mac={shortcut.mac}
              windows={shortcut.windows}
              description={shortcut.description}
            />
          );
        })}
      </GridDiv>
    </div>
  );
}

export default KeyboardShortcutsDialog;
