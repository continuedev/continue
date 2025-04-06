import { useMemo } from "react";
import Shortcut from "../../components/gui/Shortcut";
import { isJetBrains } from "../../util";

interface KeyboardShortcutProps {
  shortcut: string;
  description: string;
}

function KeyboardShortcut(props: KeyboardShortcutProps) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <span className="max-w-60 text-xs">{props.description}:</span>
      <div className="flex flex-1 flex-row items-center justify-end gap-1.5">
        <Shortcut>{props.shortcut}</Shortcut>
      </div>
    </div>
  );
}

// Shortcut strings will be rendered correctly based on the platform by the Shortcut component
const vscodeShortcuts: KeyboardShortcutProps[] = [
  {
    shortcut: "cmd '",
    description: "Toggle Selected Model",
  },
  {
    shortcut: "cmd I",
    description: "Edit highlighted code",
  },
  {
    shortcut: "cmd L",
    description:
      "New Chat / New Chat With Selected Code / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd backspace",
    description: "Cancel response",
  },
  {
    shortcut: "cmd shift I",
    description: "Toggle inline edit focus",
  },
  {
    shortcut: "cmd shift L",
    description:
      "Focus Current Chat / Add Selected Code To Current Chat / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd shift R",
    description: "Debug Terminal",
  },
  {
    shortcut: "cmd shift backspace",
    description: "Reject Diff",
  },
  {
    shortcut: "cmd shift enter",
    description: "Accept Diff",
  },
  {
    shortcut: "alt cmd N",
    description: "Reject Top Change in Diff",
  },
  {
    shortcut: "alt cmd Y",
    description: "Accept Top Change in Diff",
  },
  {
    shortcut: "cmd K cmd A",
    description: "Toggle Autocomplete Enabled",
  },
  {
    shortcut: "cmd K cmd M",
    description: "Toggle Full Screen",
  },
];

const jetbrainsShortcuts: KeyboardShortcutProps[] = [
  {
    shortcut: "cmd '",
    description: "Toggle Selected Model",
  },
  {
    shortcut: "cmd I",
    description: "Edit highlighted code",
  },
  {
    shortcut: "cmd J",
    description:
      "New Chat / New Chat With Selected Code / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd backspace",
    description: "Cancel response",
  },
  {
    shortcut: "cmd shift I",
    description: "Toggle inline edit focus",
  },
  {
    shortcut: "cmd shift J",
    description:
      "Focus Current Chat / Add Selected Code To Current Chat / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd shift backspace",
    description: "Reject Diff",
  },
  {
    shortcut: "cmd shift enter",
    description: "Accept Diff",
  },
  {
    shortcut: "alt shift J",
    description: "Quick Input",
  },
  {
    shortcut: "alt cmd J",
    description: "Toggle Sidebar",
  },
];

function KeyboardShortcuts() {
  const shortcuts = useMemo(() => {
    return isJetBrains() ? jetbrainsShortcuts : vscodeShortcuts;
  }, []);

  return (
    <div className="flex max-w-[400px] flex-col">
      <h3 className="mb-2 text-xl">Keyboard shortcuts</h3>
      <div className="flex flex-col items-center justify-center gap-x-3 gap-y-3 p-1">
        {shortcuts.map((shortcut, i) => {
          return (
            <KeyboardShortcut
              key={i}
              shortcut={shortcut.shortcut}
              description={shortcut.description}
            />
          );
        })}
      </div>
    </div>
  );
}

export default KeyboardShortcuts;

