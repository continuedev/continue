import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as util from "../../util";
import { Platform } from "../../util";
import Shortcut from "./Shortcut";

vi.mock("../../util", () => ({
  ...vi.importActual("../../util"),
  getPlatform: vi.fn(),
  getMetaKeyLabel: vi.fn(),
  getAltKeyLabel: vi.fn(),
  getFontSize: vi.fn(),
}));

describe("Shortcut component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(util.getPlatform).mockReturnValue("windows");
    vi.mocked(util.getFontSize).mockReturnValue(14);
  });
  describe("Meta key rendering across platforms", () => {
    const metaKeyInputs = ["meta", "cmd", "ctrl", "^", "⌘"];
    const platforms: Platform[] = ["windows", "mac", "linux"];

    platforms.forEach((platform) => {
      metaKeyInputs.forEach((metaKey) => {
        it(`should render "${metaKey}" as "${
          platform === "mac" ? "⌘" : "Ctrl"
        }" on ${platform}`, () => {
          vi.mocked(util.getPlatform).mockReturnValue(platform);
          vi.mocked(util.getMetaKeyLabel).mockImplementation(() => {
            if (platform === "mac") return "⌘";
            return "Ctrl";
          });
          const { container } = render(<Shortcut>{metaKey}</Shortcut>);
          const kbdElement = container.querySelector("kbd");
          expect(kbdElement?.textContent).toBe(
            platform === "mac" ? "⌘" : "Ctrl",
          );
        });
      });
    });
  });

  describe("Font class application", () => {
    it("should apply 'keyboard-key-normal' class for single characters", () => {
      const { container } = render(<Shortcut>a</Shortcut>);
      const kbdElement = container.querySelector("kbd");
      expect(kbdElement).toHaveClass("keyboard-key-normal");
    });

    it("should apply 'keyboard-key-special' class for special keys", () => {
      const { container } = render(<Shortcut>Enter</Shortcut>);
      const kbdElement = container.querySelector("kbd");
      expect(kbdElement).toHaveClass("keyboard-key-special");
    });
  });

  describe("Delete key rendering across platforms", () => {
    const deleteKeyInputs = ["backspace", "delete", "⌫"];
    const platforms: Platform[] = ["windows", "mac", "linux"];

    platforms.forEach((platform) => {
      deleteKeyInputs.forEach((deleteKey) => {
        it(`should render "${deleteKey}" correctly on ${platform}`, () => {
          vi.mocked(util.getPlatform).mockReturnValue(platform);
          const { container } = render(<Shortcut>{deleteKey}</Shortcut>);
          const kbdElement = container.querySelector("kbd");
          const expectedText = platform === "mac" ? "Delete ⌫" : "Backspace ⌫";
          expect(kbdElement?.textContent).toBe(expectedText);
          expect(kbdElement).toHaveClass("keyboard-key-special");
        });
      });
    });
  });

  describe("Invalid input handling", () => {
    it("should render error for empty shortcut string", () => {
      const { container } = render(<Shortcut>{""}</Shortcut>);
      expect(container.textContent).toBe("Error: Invalid shortcut key");
    });

    it("should render error for null input", () => {
      const { container } = render(<Shortcut>{null as any}</Shortcut>);
      expect(container.textContent).toBe("Error: Invalid shortcut key");
    });

    it("should gracefully handle invalid formatted input", () => {
      const { container } = render(<Shortcut>{"abc ,, def"}</Shortcut>);
      expect(container.querySelectorAll("kbd").length).toBeGreaterThan(0);
    });
  });

  describe("Option/Alt key rendering across platforms", () => {
    const optionKeyInputs = ["⌥", "option", "opt", "alt"];
    const platforms: util.Platform[] = ["windows", "mac"];

    platforms.forEach((platform) => {
      optionKeyInputs.forEach((optionKey) => {
        it(`should render "${optionKey}" correctly on ${platform}`, () => {
          vi.mocked(util.getPlatform).mockReturnValue(platform);
          vi.mocked(util.getAltKeyLabel).mockImplementation(() => {
            return platform === "mac" ? "Option ⌥" : "Alt";
          });

          const { container } = render(<Shortcut>{optionKey}</Shortcut>);
          const kbdElement = container.querySelector("kbd");

          const expectedText = platform === "mac" ? "Option ⌥" : "Alt";
          expect(kbdElement?.textContent).toBe(expectedText);
          expect(kbdElement).toHaveClass("keyboard-key-special");
        });
      });
    });
  });

  describe("Font class application for option/alt key", () => {
    it("should apply 'keyboard-key-special' class for option/alt key", () => {
      vi.mocked(util.getPlatform).mockReturnValue("windows");
      vi.mocked(util.getFontSize).mockReturnValue(14);
      vi.mocked(util.getAltKeyLabel).mockImplementation(() => "Alt");
      const { container } = render(<Shortcut>alt</Shortcut>);
      const kbdElement = container.querySelector("kbd");
      expect(kbdElement).toHaveClass("keyboard-key-special");
    });
  });
});
