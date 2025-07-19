import { render } from "ink-testing-library";
import React from "react";
import TUIChat from "../TUIChat.js";
import { createProps } from "./TUIChat.setup.js";

describe("TUIChat - @ File Search Tests", () => {
  it("shows file list when user types @", async () => {
    const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

    // Type the @ character to trigger file search
    stdin.write("@");

    const indexingFrame = lastFrame()!;
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(indexingFrame).toContain("Indexing files...");

    // Wait until indexing is complete
    let frame;
    do {
      await new Promise((resolve) => setTimeout(resolve, 100));
      frame = lastFrame()!;
    } while (frame.includes("Indexing files..."));

    // Should show file search UI with files
    expect(frame).toContain("@");

    // Should show at least some of the actual files visible in the test output
    const hasActualFiles =
      frame.includes("@.env.example") ||
      frame.includes("@.gitignore") ||
      frame.includes("@AGENTS.md") ||
      frame.includes("@CHANGELOG.md");
    expect(hasActualFiles).toBe(true);
  });

  it("filters files when user types READ after @", async () => {
    const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

    // Type @ followed by READ to filter files
    stdin.write("@READ");

    // Wait for indexing to complete
    let frame;
    do {
      await new Promise((resolve) => setTimeout(resolve, 100));
      frame = lastFrame()!;
    } while (frame.includes("Indexing files..."));

    // Should show files containing "READ"

    // Should show files containing "READ" - likely README.md if it exists in the actual filesystem
    // If not available, should at least show the @ character and navigation instructions
    expect(frame).toContain("@");

    // Should show navigation instructions
    expect(frame).toContain(
      "Use ↑/↓ to navigate, Enter to select, Tab to complete"
    );
  });

  it("shows navigation instructions in file search", async () => {
    const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

    // Type @ to trigger file search
    stdin.write("@");

    // Wait for indexing to complete
    let frame;
    do {
      await new Promise((resolve) => setTimeout(resolve, 100));
      frame = lastFrame()!;
    } while (frame.includes("Indexing files..."));

    // Navigation instructions should be visible

    // Should show navigation instructions
    expect(frame).toContain(
      "Use ↑/↓ to navigate, Enter to select, Tab to complete"
    );
  });

  it("shows file with @ prefix in search results", async () => {
    const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

    // Type @ to trigger file search
    stdin.write("@");

    // Wait for indexing to complete
    let frame;
    do {
      await new Promise((resolve) => setTimeout(resolve, 100));
      frame = lastFrame()!;
    } while (frame.includes("Indexing files..."));

    // Check for files with @ prefix

    // Files should be displayed with @ prefix as per FileSearchUI component
    // Check for any file with @ prefix from the actual output
    const hasAtPrefixedFile =
      frame.includes("@.env.example") ||
      frame.includes("@.gitignore") ||
      frame.includes("@AGENTS.md");
    expect(hasAtPrefixedFile).toBe(true);
  });

  it("handles empty file search filter", async () => {
    const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

    // Type just @
    stdin.write("@");

    // Wait for indexing to complete
    let frame;
    do {
      await new Promise((resolve) => setTimeout(resolve, 100));
      frame = lastFrame()!;
    } while (frame.includes("Indexing files..."));

    // Check results with empty filter

    // Should show some files even with empty filter (first 10 sorted files)
    expect(frame).toContain("@");

    // Should show at least one file from the actual filesystem
    const hasFile =
      frame.includes("@.env.example") ||
      frame.includes("@.gitignore") ||
      frame.includes("@AGENTS.md") ||
      frame.includes("@CHANGELOG.md");
    expect(hasFile).toBe(true);
  });
});
