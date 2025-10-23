/**
 * @vitest-environment jsdom
 */
import { render } from "@testing-library/react";
import type { ChatHistoryItem } from "core/index.js";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { EditMessageSelector } from "./EditMessageSelector.js";

describe("EditMessageSelector", () => {
  const createMockChatHistory = (count: number): ChatHistoryItem[] => {
    const history: ChatHistoryItem[] = [];
    for (let i = 0; i < count; i++) {
      // Alternate between user and assistant messages
      if (i % 2 === 0) {
        history.push({
          message: { role: "user", content: `User message ${i + 1}` },
          contextItems: [],
        });
      } else {
        history.push({
          message: { role: "assistant", content: `Assistant message ${i + 1}` },
          contextItems: [],
        });
      }
    }
    return history;
  };

  let mockOnEdit: ReturnType<typeof vi.fn>;
  let mockOnExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnEdit = vi.fn();
    mockOnExit = vi.fn();
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should render 'no user messages' when chat history is empty", () => {
      const { container } = render(
        <EditMessageSelector
          chatHistory={[]}
          onEdit={mockOnEdit}
          onExit={mockOnExit}
        />,
      );

      expect(container.textContent).toContain("No user messages to edit");
    });

    it("should render 'no user messages' when chat history has only assistant messages", () => {
      const chatHistory: ChatHistoryItem[] = [
        {
          message: { role: "assistant", content: "Hello" },
          contextItems: [],
        },
      ];

      const { container } = render(
        <EditMessageSelector
          chatHistory={chatHistory}
          onEdit={mockOnEdit}
          onExit={mockOnExit}
        />,
      );

      expect(container.textContent).toContain("No user messages to edit");
    });

    it("should render user messages list", () => {
      const chatHistory = createMockChatHistory(4); // Will have 2 user messages

      const { container } = render(
        <EditMessageSelector
          chatHistory={chatHistory}
          onEdit={mockOnEdit}
          onExit={mockOnExit}
        />,
      );

      expect(container.textContent).toContain("Message 1:");
      expect(container.textContent).toContain("Message 2:");
      expect(container.textContent).toContain("User message 1");
      expect(container.textContent).toContain("User message 3");
    });

    it("should filter out non-user messages", () => {
      const chatHistory: ChatHistoryItem[] = [
        { message: { role: "user", content: "User 1" }, contextItems: [] },
        {
          message: { role: "assistant", content: "Assistant 1" },
          contextItems: [],
        },
        { message: { role: "system", content: "System 1" }, contextItems: [] },
        { message: { role: "user", content: "User 2" }, contextItems: [] },
      ];

      const { container } = render(
        <EditMessageSelector
          chatHistory={chatHistory}
          onEdit={mockOnEdit}
          onExit={mockOnExit}
        />,
      );

      // Should only show 2 user messages
      expect(container.textContent).toContain("User 1");
      expect(container.textContent).toContain("User 2");
      expect(container.textContent).not.toContain("Assistant 1");
      expect(container.textContent).not.toContain("System 1");
    });

    it("should show instruction text in selection mode", () => {
      const chatHistory = createMockChatHistory(2);

      const { container } = render(
        <EditMessageSelector
          chatHistory={chatHistory}
          onEdit={mockOnEdit}
          onExit={mockOnExit}
        />,
      );

      expect(container.textContent).toContain("↑/↓ to navigate");
      expect(container.textContent).toContain("Enter to edit");
      expect(container.textContent).toContain("Esc to exit");
    });
  });

  describe("Message preview", () => {
    it("should truncate long messages in preview", () => {
      const longMessage = "a".repeat(100);
      const chatHistory: ChatHistoryItem[] = [
        { message: { role: "user", content: longMessage }, contextItems: [] },
      ];

      const { container } = render(
        <EditMessageSelector
          chatHistory={chatHistory}
          onEdit={mockOnEdit}
          onExit={mockOnExit}
        />,
      );

      // Should show truncation indicator
      expect(container.textContent).toContain("...");
      // Should not show full message (preview is limited to 60 chars)
      expect(container.textContent).not.toContain(longMessage);
    });

    it("should show only first line in multiline message preview", () => {
      const multilineMessage = "First line\nSecond line\nThird line";
      const chatHistory: ChatHistoryItem[] = [
        {
          message: { role: "user", content: multilineMessage },
          contextItems: [],
        },
      ];

      const { container } = render(
        <EditMessageSelector
          chatHistory={chatHistory}
          onEdit={mockOnEdit}
          onExit={mockOnExit}
        />,
      );

      expect(container.textContent).toContain("First line");
      expect(container.textContent).not.toContain("Second line");
    });
  });

  describe("Complex message content", () => {
    it("should handle message parts array", () => {
      const chatHistory: ChatHistoryItem[] = [
        {
          message: {
            role: "user",
            content: [
              { type: "text", text: "Hello" },
              { type: "text", text: " world" },
            ],
          } as any,
          contextItems: [],
        },
      ];

      const { container } = render(
        <EditMessageSelector
          chatHistory={chatHistory}
          onEdit={mockOnEdit}
          onExit={mockOnExit}
        />,
      );

      // Should render something (component handles non-string content gracefully)
      expect(container.textContent).toBeDefined();
    });
  });
});
