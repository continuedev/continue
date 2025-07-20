import { render } from "ink-testing-library";
import React from "react";
import TUIChat from "../TUIChat.js";
import { createProps } from "./TUIChat.setup.js";

describe("TUIChat - Message Handling", () => {
  describe("Message Display", () => {
    it("renders user messages", async () => {
      const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

      // Send a message
      stdin.write("This is a test message");
      stdin.write("\r");

      // Wait for the UI to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      const frame = lastFrame();

      // Should show the user message in the chat
      expect(frame).toContain("This is a test message");
    });
  });

  describe("Chat History", () => {
    it("preserves message history", async () => {
      const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

      // Send multiple messages
      stdin.write("First message");
      stdin.write("\r");

      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("Second message");
      stdin.write("\r");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const frame = lastFrame();

      // Both messages should be visible
      expect(frame).toContain("First message");
      expect(frame).toContain("Second message");
    });

    it("handles long conversation history", async () => {
      const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

      // Send multiple messages quickly
      for (let i = 0; i < 5; i++) {
        stdin.write(`Message ${i}`);
        stdin.write("\r");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const frame = lastFrame();

      // Should contain some messages (exact count may vary due to scrolling)
      expect(frame).toMatch(/Message \d/);
    });
  });

  describe("Error Handling", () => {
    it("handles empty messages gracefully", async () => {
      const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

      // Send empty message
      stdin.write("\r");

      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame();

      // Should still show the interface
      expect(frame).toContain("Ask anything");
    });

    it("displays interface when no initial prompt", () => {
      const { lastFrame } = render(<TUIChat {...createProps()} />);

      const frame = lastFrame();

      // Should show the default interface
      expect(frame).toContain("Ask anything");
    });
  });
});
