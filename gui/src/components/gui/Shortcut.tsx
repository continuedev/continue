import React from "react";
import { getFontSize, getPlatform, getMetaKeyLabel, getAltKeyLabel } from "../../util";
import "../../../src/index.css";
import "./Shortcut.css";

interface ShortcutProps {
  children: string;
}

const keyMap: { [key: string]: string } = {
  uparrow: "UpArrow ↑",
  downarrow: "DownArrow ↓",
  leftarrow: "LeftArrow ←",
  rightarrow: "RightArrow →",
  enter: "Enter ⏎",
};

const metaKeys = ["meta","⌘", "Ctrl", "Super"];
const altKeys = ["alt", "option", "⌥"];
const modifierKeys = [...metaKeys, ...altKeys];

const Shortcut: React.FC<ShortcutProps> = ({ children }) => {
  const platform = getPlatform();

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
            keyMap[key.toLowerCase()] ||
            key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
          );
        });
    });
  };

  const shortcuts = parseShortcut(children);

  return (
    <span className="shortcut-wrapper">
      {shortcuts.map((combo, comboIndex) => (
        <React.Fragment key={comboIndex}>
          {combo.map((key, keyIndex) => (
            <React.Fragment key={keyIndex}>
              <kbd
                className={`keyboard-key ${
                  modifierKeys.includes(key)
                    ? "keyboard-key-meta"
                    : "keyboard-key-normal"
                }`}
                style={{
                  fontSize:
                    modifierKeys.includes(key) && platform === "mac"
                      ? `${getFontSize() - 2}px`
                      : `${getFontSize() - 3}px`,
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
    </span>
  );
};

export default Shortcut;