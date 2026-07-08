import React from "react";
import "../../../src/index.css";
import {
  getAltKeyLabel,
  getFontSize,
  getMetaKeyLabel,
  getPlatform,
} from "../../util";
import "./Shortcut.css";

interface ShortcutProps {
  children: string;
}

const fontSize = getFontSize();

const metaKeys = ["meta", "⌘", "ctrl", "cmd", "^"];
const altKeys = ["alt", "option", "opt", "⌥"];
const modifierKeys = [...metaKeys, ...altKeys];

const getSpecialKeyMap = (platform: string): Record<string, string> => ({
  uparrow: "UpArrow ↑",
  downarrow: "DownArrow ↓",
  leftarrow: "LeftArrow ←",
  rightarrow: "RightArrow →",
  enter: "Enter ⏎",
  esc: "Esc",
  backspace: platform === "mac" ? "Delete ⌫" : "Backspace ⌫",
  delete: platform === "mac" ? "Delete ⌫" : "Backspace ⌫",
  "⌫": platform === "mac" ? "Delete ⌫" : "Backspace ⌫",
});

const parseShortcut = (shortcut: string, platform: string) => {
  if (!shortcut || typeof shortcut !== "string") {
    console.warn("Invalid shortcut provided:", shortcut);
    return [];
  }

  const specialKeyMap = getSpecialKeyMap(platform);
  return shortcut
    .split(",")
    .map((combo) =>
      combo
        .trim()
        .split(" ")
        .filter((key) => key)
        .map((key) => {
          const lowerKey = key.toLowerCase();
          if (metaKeys.includes(lowerKey)) return getMetaKeyLabel();
          if (altKeys.includes(lowerKey)) return getAltKeyLabel();
          return specialKeyMap[lowerKey] || capitalizeKey(key);
        }),
    )
    .filter((combo) => combo.length > 0);
};

const capitalizeKey = (key: string) =>
  key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();

const isSingleCharNonModifier = (key: string) =>
  key && key.length === 1 && /^[a-zA-Z0-9]$/.test(key);

const Shortcut: React.FC<ShortcutProps> = ({ children }) => {
  const platform = getPlatform();
  if (!children || typeof children !== "string") {
    return <span>Error: Invalid shortcut key</span>;
  }

  const shortcuts = parseShortcut(children, platform);

  return (
    <>
      {shortcuts.map((combo, comboIndex) => (
        <React.Fragment key={comboIndex}>
          {combo.map((key, keyIndex) => (
            <React.Fragment key={keyIndex}>
              <kbd
                className={`keyboard-key ${
                  !isSingleCharNonModifier(key) || key === "⌫"
                    ? "keyboard-key-special"
                    : "keyboard-key-normal"
                }`}
                style={{
                  fontSize:
                    key &&
                    modifierKeys.includes(key.toLowerCase()) &&
                    platform === "mac"
                      ? `${fontSize - 2}px`
                      : `${fontSize - 3}px`,
                }}
              >
                {key || "?"}
              </kbd>
              {keyIndex < combo.length - 1 && (
                <span className="separator">+</span>
              )}
            </React.Fragment>
          ))}
          {comboIndex < shortcuts.length - 1 && (
            <span className="separator">,</span>
          )}
        </React.Fragment>
      ))}
    </>
  );
};

export default Shortcut;
