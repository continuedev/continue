import { describe, expect, it } from "vitest";
import { isTextInputTarget } from ".";

describe("isTextInputTarget", () => {
  it("matches native text-editing elements", () => {
    expect(isTextInputTarget(document.createElement("input"))).toBe(true);
    expect(isTextInputTarget(document.createElement("textarea"))).toBe(true);
  });

  it("matches descendants of contenteditable editors", () => {
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    editor.appendChild(child);

    expect(isTextInputTarget(child)).toBe(true);
  });

  it("ignores non-editable targets", () => {
    expect(isTextInputTarget(document.createElement("button"))).toBe(false);
    expect(isTextInputTarget(null)).toBe(false);
  });
});
