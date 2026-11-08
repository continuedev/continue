import { stripVTControlCharacters } from "node:util";

import { describe, expect, it } from "vitest";

import { bannerWidth, getDisplayableAsciiArt } from "./asciiArt.js";

const plain = (s: string) => stripVTControlCharacters(s);
const LOOP_TOP = "▄████▄";
const WORD_TOP = "██████╗ ██████╗ ███╗   ██╗████████╗";

describe("getDisplayableAsciiArt", () => {
  it("uses the one-line banner when the terminal is short", () => {
    const banner = plain(getDisplayableAsciiArt(120, 14)).trim();
    expect(banner.split("\n")).toHaveLength(1);
    expect(banner).toContain("continuous");
  });

  it("uses the tall banner when the rows are there", () => {
    expect(plain(getDisplayableAsciiArt(120, 19))).toContain(WORD_TOP);
  });

  it("shows the loop and the CONTINUOUS wordmark on a wide terminal", () => {
    const banner = plain(getDisplayableAsciiArt(120));
    expect(banner).toContain(LOOP_TOP);
    expect(banner).toContain(WORD_TOP);
    // Six rows of art plus the version, all lined up
    const rows = banner.split("\n").filter(Boolean);
    expect(rows).toHaveLength(7);
    const widths = new Set(rows.slice(0, 6).map((r) => [...r].length));
    expect(widths.size).toBe(1);
    expect(rows[6].trim()).toMatch(/^v/);
  });

  it("drops the loop when only the wordmark fits", () => {
    const banner = plain(getDisplayableAsciiArt(90));
    expect(banner).toContain(WORD_TOP);
    expect(banner).not.toContain(LOOP_TOP);
  });

  it("shows the loop with the name beside it on a narrow terminal", () => {
    const banner = plain(getDisplayableAsciiArt(60));
    expect(banner).toContain(LOOP_TOP);
    expect(banner).toContain("continuous");
    expect(banner).not.toContain(WORD_TOP);
  });

  it("falls back to one line on a very narrow terminal", () => {
    const banner = plain(getDisplayableAsciiArt(20)).trim();
    expect(banner.split("\n")).toHaveLength(1);
    expect(banner).toMatch(/^continuous v/);
  });

  it("never shows art wider than the terminal allows", () => {
    // Only the one-line fallback may wrap, on terminals narrower than it
    for (const columns of [20, 34, 35, 60, 85, 86, 90, 109, 110, 200]) {
      const banner = getDisplayableAsciiArt(columns);
      const lines = plain(banner).split("\n").filter(Boolean);
      if (lines.length > 1) {
        expect(bannerWidth(banner) + 2).toBeLessThanOrEqual(columns);
      }
    }
  });

  it("uses the terminal width when none is given", () => {
    const original = process.stdout.columns;
    try {
      process.stdout.columns = 90;
      expect(plain(getDisplayableAsciiArt())).toContain(WORD_TOP);
    } finally {
      process.stdout.columns = original;
    }
  });

  it("says continuous, not continue", () => {
    for (const columns of [20, 60, 90, 120]) {
      expect(plain(getDisplayableAsciiArt(columns))).not.toMatch(
        /CONTINUE(?!US)|\bcontinue\b/,
      );
    }
  });
});
