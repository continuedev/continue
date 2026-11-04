import { useContext } from "react";
import Switch from "../../../components/gui/Switch";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppSelector } from "../../../redux/hooks";

const MODES = [
  { key: "chat", label: "Chat" },
  { key: "plan", label: "Plan" },
  { key: "agent", label: "Agent" },
] as const;

/**
 * Switches for sending rules in each mode, saved as `rulesByMode` in the
 * global config.yaml. A mode with no entry is on.
 */
export function RulesByModeToggles() {
  const ideMessenger = useContext(IdeMessengerContext);
  const rulesByMode = useAppSelector((s) => s.config.config.rulesByMode);

  const toggle = async (mode: (typeof MODES)[number]["key"]) => {
    const enabled = rulesByMode?.[mode] !== false;
    // Turning a mode back on removes the entry rather than writing `true`.
    await ideMessenger.request("config/setRulesByMode", {
      [mode]: enabled ? false : null,
    });
  };

  return (
    <div
      className="flex flex-col gap-2 px-2 py-1.5"
      data-testid="rules-by-mode"
    >
      <span className="text-xs opacity-65">
        Send rules in these modes (saved in config.yaml)
      </span>
      {MODES.map(({ key, label }) => (
        <div key={key} data-testid={`rules-mode-${key}`}>
          <Switch
            text={label}
            isToggled={rulesByMode?.[key] !== false}
            onToggle={() => void toggle(key)}
          />
        </div>
      ))}
    </div>
  );
}
