import React from "react";
import {
  getFontSize,
  getPlatform,
  getMetaKeyLabel,
  getAltKeyLabel,
} from "../../util";
import "../../../src/index.css";
import "./Shortcut.css";

interface ShortcutProps {
  children: string;
}

const specialKeyMap: { [key: string]: string } = {
  uparrow: "UpArrow ↑",
  downarrow: "DownArrow ↓",
  leftarrow: "LeftArrow ←",
  rightarrow: "RightArrow →",
  enter: "Enter ⏎",
  esc: "Esc",
};

const metaKeys = ["meta", "⌘", "ctrl"];
const altKeys = ["alt", "option", "⌥"];
const modifierKeys = [...metaKeys, ...altKeys];

const platform = getPlatform();
const fontSize = getFontSize();

const parseShortcut = (shortcut: string) => {
  return shortcut.split(",").map((combo) => {
    return combo
      .trim()
      .split(" ")
      .map((key) => {
        const lowerKey = key.toLowerCase();
        if (metaKeys.includes(lowerKey)) {
          return getMetaKeyLabel();
        }
        if (altKeys.includes(lowerKey)) {
          return getAltKeyLabel();
        }
        return (
          specialKeyMap[lowerKey] ||
          key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
        );
      });
  });
};

const isSingleCharNonModifier = (key: string) => {
  const lowerKey = key.toLowerCase();
  return (
    key.length === 1 &&
    !modifierKeys.includes(lowerKey) &&
    !specialKeyMap[lowerKey]
  );
};

const Shortcut: React.FC<ShortcutProps> = ({ children }) => {
  const shortcuts = parseShortcut(children);

  return (
    <>
      {shortcuts.map((combo, comboIndex) => (
        <React.Fragment key={comboIndex}>
          {combo.map((key, keyIndex) => (
            <React.Fragment key={keyIndex}>
              <kbd
                className={`keyboard-key ${
                  !isSingleCharNonModifier(key)
                    ? "keyboard-key-special"
                    : "keyboard-key-normal"
                }`}
                style={{
                  fontSize:
                    modifierKeys.includes(key.toLowerCase()) &&
                    platform === "mac"
                      ? `${fontSize - 2}px`
                      : `${fontSize - 3}px`,
                }}
              >
                {key}
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
