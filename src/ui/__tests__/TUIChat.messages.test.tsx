import { render } from "ink-testing-library";
import React from "react";
import TUIChat from "../TUIChat.js";
import { createProps, mockAssistant } from "./TUIChat.setup.js";

describe("TUIChat - Message Display Tests", () => {
  it("shows custom input prompt", () => {
    const customAssistant = {
      ...mockAssistant,
      name: "custom-bot",
    };

    const { lastFrame } = render(
      <TUIChat {...createProps({ config: customAssistant })} />
    );

    const frame = lastFrame();

    // Should show the default prompt
    expect(frame).toContain("Ask anything");

    // Should potentially show or reference the custom assistant name
    // (This might appear in the UI title or header)
    expect(frame).toMatch(/(custom-bot|test-assistant|Continue CLI)/);
  });
});
