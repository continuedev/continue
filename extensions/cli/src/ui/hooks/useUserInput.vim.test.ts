import { describe, expect, it, vi } from "vitest";

import { TextBuffer } from "../TextBuffer.js";
import { handleVimNormalModeKey } from "./useUserInput.js";

describe("handleVimNormalModeKey", () => {
  it("moves the cursor with vim motions", () => {
    const textBuffer = new TextBuffer("alpha beta");
    textBuffer.setCursor(6);

    handleVimNormalModeKey({
      input: "b",
      key: {},
      textBuffer,
      enterInsertMode: vi.fn(),
    });
    expect(textBuffer.cursor).toBe(0);

    handleVimNormalModeKey({
      input: "w",
      key: {},
      textBuffer,
      enterInsertMode: vi.fn(),
    });
    expect(textBuffer.cursor).toBe(6);

    handleVimNormalModeKey({
      input: "$",
      key: {},
      textBuffer,
      enterInsertMode: vi.fn(),
    });
    expect(textBuffer.cursor).toBe("alpha beta".length);
  });

  it("deletes with x without entering insert mode", () => {
    const textBuffer = new TextBuffer("alpha");
    textBuffer.setCursor(1);

    const enterInsertMode = vi.fn();
    const handled = handleVimNormalModeKey({
      input: "x",
      key: {},
      textBuffer,
      enterInsertMode,
    });

    expect(handled).toBe(true);
    expect(textBuffer.text).toBe("apha");
    expect(enterInsertMode).not.toHaveBeenCalled();
  });

  it("switches back to insert mode with i, a, I, and A", () => {
    const textBuffer = new TextBuffer("alpha beta");
    textBuffer.setCursor(5);

    const enterInsertMode = vi.fn();

    handleVimNormalModeKey({
      input: "i",
      key: {},
      textBuffer,
      enterInsertMode,
    });
    expect(enterInsertMode).toHaveBeenCalledTimes(1);

    handleVimNormalModeKey({
      input: "a",
      key: {},
      textBuffer,
      enterInsertMode,
    });
    expect(textBuffer.cursor).toBe(6);
    expect(enterInsertMode).toHaveBeenCalledTimes(2);

    handleVimNormalModeKey({
      input: "I",
      key: {},
      textBuffer,
      enterInsertMode,
    });
    expect(textBuffer.cursor).toBe(0);
    expect(enterInsertMode).toHaveBeenCalledTimes(3);

    handleVimNormalModeKey({
      input: "A",
      key: {},
      textBuffer,
      enterInsertMode,
    });
    expect(textBuffer.cursor).toBe("alpha beta".length);
    expect(enterInsertMode).toHaveBeenCalledTimes(4);
  });

  it("lets enter fall through to the normal submit path", () => {
    const textBuffer = new TextBuffer("alpha");

    const handled = handleVimNormalModeKey({
      input: "",
      key: { return: true, shift: false },
      textBuffer,
      enterInsertMode: vi.fn(),
    });

    expect(handled).toBe(false);
  });
});
