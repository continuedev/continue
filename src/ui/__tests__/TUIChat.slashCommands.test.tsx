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
    await new Promise((resolve) => setTimeout(resolve, 100));

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

  it("hides slash command selector when complete command is typed", async () => {
    const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

    // Type /cle to show partial command dropdown
    stdin.write("/cle");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const framePartial = lastFrame();

    // Should show the slash command dropdown for partial match
    expect(framePartial).toContain("/clear");
    expect(framePartial).toContain("Clear the chat history");

    // Type the rest to complete the command /clear
    stdin.write("ar");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frameComplete = lastFrame();

    // Should NOT show the slash command dropdown anymore since we have a complete command
    expect(frameComplete).not.toContain("Clear the chat history");
    expect(frameComplete).not.toContain(
      "Use ↑/↓ to navigate, Enter to select, Tab to complete"
    );

    // But should still show the input with /clear
    expect(frameComplete).toContain("/clear");
  });

  it("shows slash command selector again if typing continues past complete command", async () => {
    const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

    // Type complete command /clear
    stdin.write("/clear");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frameComplete = lastFrame();

    // Should NOT show the dropdown for complete command
    expect(frameComplete).not.toContain("Clear the chat history");

    // Type more characters to make it not match any command
    stdin.write("xyz");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frameInvalid = lastFrame();

    // Should show "No matching commands found" since /clearxyz doesn't match anything
    expect(frameInvalid).toContain("No matching commands found");
  });

  it("hides slash command selector when space is typed after complete command", async () => {
    const { lastFrame, stdin } = render(<TUIChat {...createProps()} />);

    // Type complete command /help
    stdin.write("/help");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frameComplete = lastFrame();

    // Should NOT show the dropdown for complete command
    expect(frameComplete).not.toContain("Show help message");

    // Type a space after the complete command
    stdin.write(" ");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const frameWithSpace = lastFrame();

    // Should still NOT show the dropdown after space
    expect(frameWithSpace).not.toContain("Show help message");
    expect(frameWithSpace).not.toContain(
      "Use ↑/↓ to navigate, Enter to select, Tab to complete"
    );

    // But should show the input with /help
    expect(frameWithSpace).toContain("/help ");
  });
});
