import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CONTINUE_ASCII_ART, getDisplayableAsciiArt } from "./asciiArt.js";

describe("asciiArt", () => {
  let originalColumns: number | undefined;

  beforeEach(() => {
    originalColumns = process.stdout.columns;
  });

  afterEach(() => {
    if (originalColumns === undefined) {
      delete (process.stdout as any).columns;
    } else {
      process.stdout.columns = originalColumns;
    }
  });

  describe("getDisplayableAsciiArt", () => {
    it("should return full ASCII art when terminal is wide enough", () => {
      // Set process.stdout.columns to simulate wide terminal
      process.stdout.columns = 80;

      const result = getDisplayableAsciiArt();

      expect(result).toBe(CONTINUE_ASCII_ART);
    });

    it("should return CN ASCII art version when terminal is too narrow", () => {
      // Set process.stdout.columns to simulate narrow terminal
      process.stdout.columns = 60;

      const result = getDisplayableAsciiArt();

      expect(result).toContain("██████╗");

      expect(result).not.toBe(CONTINUE_ASCII_ART);
      // Should be much shorter than the full ASCII art
      expect(result.length).toBeLessThan(CONTINUE_ASCII_ART.length / 2);
    });

    it("should return CN ASCII art version when terminal is below threshold", () => {
      // Test the edge case at exactly 74 columns (below our threshold of 75)
      process.stdout.columns = 74;

      const result = getDisplayableAsciiArt();

      expect(result).toContain("██████╗");

      expect(result).not.toBe(CONTINUE_ASCII_ART);
    });

    it("should return full ASCII art when terminal is exactly at threshold", () => {
      // Test the edge case at exactly 75 columns (our threshold)
      process.stdout.columns = 75;

      const result = getDisplayableAsciiArt();

      expect(result).toBe(CONTINUE_ASCII_ART);
    });

    it("should default to full ASCII art when columns is undefined", () => {
      // Set process.stdout.columns to undefined (should default to 80)
      delete (process.stdout as any).columns;

      const result = getDisplayableAsciiArt();

      expect(result).toBe(CONTINUE_ASCII_ART);
    });
  });
});
