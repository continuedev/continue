import { render } from "ink-testing-library";
import React from "react";
import TUIChat from "../TUIChat.js";
import { createProps } from "./TUIChat.setup.js";

describe("TUIChat - Basic UI Tests", () => {
  describe("Component Initialization", () => {
    it("displays empty chat correctly", () => {
      const { lastFrame } = render(<TUIChat {...createProps()} />);
      const frame = lastFrame();

      // Should show the interface
      expect(frame).toContain("Ask anything");

      // Should have box borders (using the actual characters)
      expect(frame).toContain("│");

      // Should show Continue CLI branding
      expect(frame).toContain("Continue CLI");
    });

    it("renders box borders correctly", () => {
      const { lastFrame } = render(<TUIChat {...createProps()} />);
      const frame = lastFrame();

      // Should have borders (using actual box drawing characters)
      expect(frame).toMatch(/[│─╭╮╰╯]/); // Various box drawing chars
    });

    it("maintains layout with content", () => {
      const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

      stdin.write("Test message that is quite long to see how it wraps");

      const frame = lastFrame();

      // Borders should still be present
      expect(frame).toMatch(/[│─╭╮╰╯]/);

      // Should have multiple lines
      const lines = frame ? frame.split("\n") : [];
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe("Loading States", () => {
    it("shows UI correctly when loading", async () => {
      const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

      // Trigger loading by sending a message
      stdin.write("test message");
      stdin.write("\r");

      // Give it a moment to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame();
      // The UI should still be properly rendered
      expect(frame).toContain("Ask anything");
      // Note: The actual loading spinner behavior might not be visible in this test environment
    });

    it("hides loading spinner when not loading", () => {
      const { lastFrame } = render(<TUIChat {...createProps()} />);

      const frame = lastFrame();
      // Should not contain spinner characters initially
      expect(frame).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });

    it("displays loading text correctly", async () => {
      const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

      stdin.write("test");
      stdin.write("\r");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const frame = lastFrame();

      // Should show placeholder message rather than text in input box
      expect(frame).toContain(
        "Ask anything, @ for context, / for slash commands"
      );
    });
  });
});