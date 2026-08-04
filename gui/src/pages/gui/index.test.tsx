import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("GUI sidebar shell layout", () => {
  it("uses panel-relative width and allows flex children to shrink", () => {
    const source = readFileSync("src/pages/gui/index.tsx", "utf8");

    expect(source).toMatch(/className="[^"]*\bw-full\b[^"]*"/);
    expect(source).not.toMatch(/className="[^"]*\bw-screen\b[^"]*"/);
    expect(source).toMatch(/<div className="[^"]*\bmin-w-0\b[^"]*">/);
    expect(source).toMatch(/<main className="[^"]*\bmin-w-0\b[^"]*">/);
  });
});
