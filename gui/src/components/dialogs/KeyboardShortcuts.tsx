import React from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
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

const KeyDiv = styled.div`
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
          return <KeyDiv>{key}</KeyDiv>;
        })}
      </div>
    </div>
  );
}

const vscodeShortcuts: KeyboardShortcutProps[] = [
  {
    mac: "⌘ M",
    windows: "⌃ M",
    description: "Ask about Highlighted Code",
  },
  {
    mac: "⌘ ⇧ M",
    windows: "⌃ ⇧ M",
    description: "Edit Highlighted Code",
  },
  {
    mac: "⌘ ⇧ ↵",
    windows: "⌃ ⇧ ↵",
    description: "Accept Diff",
  },
  {
    mac: "⌘ ⇧ ⌫",
    windows: "⌃ ⇧ ⌫",
    description: "Reject Diff",
  },
  {
    mac: "⌘ ⇧ L",
    windows: "⌃ ⇧ L",
    description: "Quick Text Entry",
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
    mac: "⌥ ⌘ N",
    windows: "⌥ ⌃ N",
    description: "New Session",
  },
  {
    mac: "⌘ ⌫",
    windows: "⌃ ⌫",
    description: "Stop Active Step",
  },
];

const jetbrainsShortcuts: KeyboardShortcutProps[] = [
  {
    mac: "⌘ J",
    windows: "⌃ J",
    description: "Ask about Highlighted Code",
  },
  {
    mac: "⌘ ⇧ J",
    windows: "⌃ ⇧ J",
    description: "Edit Highlighted Code",
  },
  {
    mac: "⌘ ⇧ ↵",
    windows: "⌃ ⇧ ↵",
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
    description: "Quick Text Entry",
  },
  {
    mac: "⌥ ⌘ J",
    windows: "⌥ ⌃ J",
    description: "Toggle Auxiliary Bar",
  },
  {
    mac: "⌘ ⌃ N",
    windows: "⌥ ⌃ N",
    description: "New Session",
  },
  {
    mac: "⌘ ⌫",
    windows: "⌃ ⌫",
    description: "Stop Active Step",
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
