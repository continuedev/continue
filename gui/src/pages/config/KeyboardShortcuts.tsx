import { useMemo } from "react";
import Shortcut from "../../components/gui/Shortcut";
import { isJetBrains } from "../../util";

interface KeyboardShortcutProps {
  shortcut: string;
  description: string;
  isEven: boolean;
}

function KeyboardShortcut(props: KeyboardShortcutProps) {
  return (
    <div
      className="sm:flex-row flex-col flex items-start sm:items-center py-2"
      style={{
        backgroundColor: props.isEven ? '#1e1e1e' : 'transparent',
      }}
    >
      <div className="flex-grow pr-4 pb-1 sm:pb-0 w-full sm:w-auto">
        <span className="text-xs block break-words">{props.description}:</span>
      </div>
      <div className="flex-shrink-0 whitespace-nowrap">
        <Shortcut>{props.shortcut}</Shortcut>
      </div>
    </div>
  );
}

// Shortcut strings will be rendered correctly based on the platform by the Shortcut component
const vscodeShortcuts: Omit<KeyboardShortcutProps, 'isEven'>[] = [
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

const jetbrainsShortcuts: Omit<KeyboardShortcutProps, 'isEven'>[] = [
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
    <div className="p-5 h-full overflow-auto">
      <h3 className="mb-5 text-xl">Keyboard shortcuts</h3>
      <div>
        {shortcuts.map((shortcut, i) => {
          return (
            <KeyboardShortcut
              key={i}
              shortcut={shortcut.shortcut}
              description={shortcut.description}
              isEven={i % 2 === 0}
            />
          );
        })}
      </div>
    </div>
  );
}

export default KeyboardShortcuts;

