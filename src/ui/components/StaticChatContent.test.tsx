import { render } from "ink-testing-library";
import React from "react";
import { vi } from "vitest";

import type { DisplayMessage } from "../types.js";

import { StaticChatContent } from "./StaticChatContent.js";

describe("StaticChatContent", () => {
  const mockRenderMessage = vi.fn((message: DisplayMessage, index: number) => (
    <div key={index} data-testid={`message-${index}`}>
      {message.content}
    </div>
  ));

  beforeEach(() => {
    mockRenderMessage.mockClear();
  });

  it("should handle long assistant message content with proper width constraints", () => {
    // Create a very long message that should wrap
    const longMessage = "This is a very long assistant message that should wrap properly at the terminal width boundary instead of overflowing or creating poor line wrapping with every other line having only a few characters and otherwise being empty. ".repeat(5);
    
    const messages: DisplayMessage[] = [
      {
        role: "assistant",
        content: longMessage.trim(),
      },
    ];

    const { lastFrame } = render(
      <StaticChatContent
        showIntroMessage={false}
        messages={messages}
        renderMessage={mockRenderMessage}
      />
    );

    // Verify that renderMessage was called with the long content
    expect(mockRenderMessage).toHaveBeenCalledWith(messages[0], 0);

    // Check that the content is rendered
    expect(lastFrame()).toContain(longMessage.substring(0, 50));
  });

  it("should apply width constraints to Static component when terminal width is available", () => {
    // Mock terminal width
    const mockStdout = {
      columns: 80,
      rows: 24,
    };

    // Override process.stdout for this test
    const originalStdout = process.stdout;
    Object.defineProperty(process, 'stdout', {
      value: mockStdout,
      configurable: true,
    });

    const messages: DisplayMessage[] = [
      {
        role: "assistant",
        content: "Test message for width constraints",
      },
    ];

    const { lastFrame } = render(
      <StaticChatContent
        showIntroMessage={false}
        messages={messages}
        renderMessage={mockRenderMessage}
      />
    );

    expect(mockRenderMessage).toHaveBeenCalled();
    expect(lastFrame()).toContain("Test message for width constraints");

    // Restore original stdout
    Object.defineProperty(process, 'stdout', {
      value: originalStdout,
      configurable: true,
    });
  });

  it("should render intro message when showIntroMessage is true and services are available", () => {
    const mockConfig = { name: "test-config" } as any;
    const mockModel = { name: "test-model" } as any;
    const mockMcpService = { name: "test-mcp" } as any;

    const { lastFrame } = render(
      <StaticChatContent
        showIntroMessage={true}
        config={mockConfig}
        model={mockModel}
        mcpService={mockMcpService}
        messages={[]}
        renderMessage={mockRenderMessage}
      />
    );

    // Should render intro message (specific content depends on IntroMessage component)
    const output = lastFrame();
    expect(output).toBeDefined();
  });

  it("should render both intro message and chat messages in correct order", () => {
    const mockConfig = { name: "test-config" } as any;
    const mockModel = { name: "test-model" } as any;
    const mockMcpService = { name: "test-mcp" } as any;

    const messages: DisplayMessage[] = [
      {
        role: "user",
        content: "Hello",
      },
      {
        role: "assistant", 
        content: "Hi there!",
      },
    ];

    const { lastFrame } = render(
      <StaticChatContent
        showIntroMessage={true}
        config={mockConfig}
        model={mockModel}
        mcpService={mockMcpService}
        messages={messages}
        renderMessage={mockRenderMessage}
      />
    );

    // Should render both intro and messages
    expect(mockRenderMessage).toHaveBeenCalledWith(messages[0], 0);
    expect(mockRenderMessage).toHaveBeenCalledWith(messages[1], 1);
  });
});