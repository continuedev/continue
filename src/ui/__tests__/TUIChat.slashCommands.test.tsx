import { render } from "ink-testing-library";
import React from "react";
import TUIChat from "../TUIChat.js";
import { createProps } from "./TUIChat.setup.js";

describe("TUIChat - Slash Commands Tests", () => {
  it("filters slash commands when typing /log", async () => {
    const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

    // Type /log to trigger slash command filtering
    stdin.write("/log");

    // Wait a bit for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();

    // Should show the slash command dropdown
    expect(frame).toContain("/login");
    expect(frame).toContain("/logout");

    // Should also show descriptions
    expect(frame).toContain("Authenticate with your account");
    expect(frame).toContain("Sign out of your current session");

    // Should show navigation hint
    expect(frame).toContain(
      "Use ↑/↓ to navigate, Enter to select, Tab to complete"
    );

    // Now test Tab completion
    stdin.write("\t");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frameAfterTab = lastFrame();

    // Should autocomplete to /login (first matching command)
    expect(frameAfterTab).toContain("/login ");
  });
});