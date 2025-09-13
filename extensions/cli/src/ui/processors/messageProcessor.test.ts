import { describe, it, expect } from "vitest";

import { processHistoryToMessageRows } from "./messageProcessor.js";

describe("messageProcessor", () => {
  describe("processHistoryToMessageRows", () => {
    it("should render user messages with correct bullet and margin formatting", () => {
      const chatHistory = [
        {
          message: {
            role: "user" as const,
            content:
              "This is a long message that should be split across multiple rows to test the formatting and ensure that only the first row has a bullet point and only the last row has margin.",
          },
          contextItems: [],
        },
      ];

      const terminalWidth = 50; // Force splitting
      const messageRows = processHistoryToMessageRows(
        chatHistory,
        terminalWidth,
      );

      // Should create multiple rows
      expect(messageRows.length).toBeGreaterThan(1);

      // All rows should be user messages
      messageRows.forEach((row) => {
        expect(row.role).toBe("user");
        expect(row.rowType).toBe("content");
      });

      // Only first row should have bullet
      expect(messageRows[0].showBullet).toBe(true);
      messageRows.slice(1).forEach((row) => {
        expect(row.showBullet).toBe(false);
      });

      // Only last row should have margin
      messageRows.slice(0, -1).forEach((row) => {
        expect(row.marginBottom).toBe(0);
      });
      expect(messageRows[messageRows.length - 1].marginBottom).toBe(1);
    });

    it("should render single-row user messages correctly", () => {
      const chatHistory = [
        {
          message: {
            role: "user" as const,
            content: "Short message",
          },
          contextItems: [],
        },
      ];

      const terminalWidth = 80;
      const messageRows = processHistoryToMessageRows(
        chatHistory,
        terminalWidth,
      );

      expect(messageRows.length).toBe(1);
      expect(messageRows[0].showBullet).toBe(true);
      expect(messageRows[0].marginBottom).toBe(1);
    });
  });

  it("should handle multiple separate user messages correctly", () => {
    const chatHistory = [
      {
        message: {
          role: "user" as const,
          content: "First user message",
        },
        contextItems: [],
      },
      {
        message: {
          role: "assistant" as const,
          content: "Assistant response",
        },
        contextItems: [],
      },
      {
        message: {
          role: "user" as const,
          content:
            "Second user message that is long enough to potentially wrap across multiple lines in a narrow terminal",
        },
        contextItems: [],
      },
    ];

    const terminalWidth = 30; // Force splitting for the long message
    const messageRows = processHistoryToMessageRows(chatHistory, terminalWidth);

    // Find user message rows
    const userRows = messageRows.filter((row) => row.role === "user");
    const assistantRows = messageRows.filter((row) => row.role === "assistant");

    expect(userRows.length).toBeGreaterThan(2); // Should have multiple rows for the long second user message
    expect(assistantRows.length).toBeGreaterThanOrEqual(1);

    // Check that each user message group has correct bullet/margin pattern
    const currentUserGroup = 0;
    const rowsInCurrentGroup = 0;
    const userGroupStarts: number[] = [];

    // Find where each user message group starts
    for (let i = 0; i < messageRows.length; i++) {
      if (messageRows[i].role === "user") {
        if (messageRows[i].showBullet) {
          userGroupStarts.push(i);
        }
      }
    }

    expect(userGroupStarts.length).toBe(2); // Two user messages

    // Verify each user group has proper bullet/margin formatting
    userGroupStarts.forEach((startIndex) => {
      // Find the end of this user group
      let endIndex = startIndex;
      while (
        endIndex + 1 < messageRows.length &&
        messageRows[endIndex + 1].role === "user" &&
        !messageRows[endIndex + 1].showBullet
      ) {
        endIndex++;
      }

      // First row should have bullet
      expect(messageRows[startIndex].showBullet).toBe(true);

      // Last row should have margin
      expect(messageRows[endIndex].marginBottom).toBe(1);

      // Middle rows (if any) should have no bullet and no margin
      for (let i = startIndex + 1; i < endIndex; i++) {
        expect(messageRows[i].showBullet).toBe(false);
        expect(messageRows[i].marginBottom).toBe(0);
      }
    });
  });

  it("should debug output for a very long message case", () => {
    const longMessage =
      "et nunc. Duis varius ex non mattis ornare. Curabitur dictum eleifend sem non pellentesque. Maecenas laoreet metus vel pellentesque molestie. Quisque ut auctor purus. Praesent at libero vitae purus ultricies egestas at at sem. Nulla pellentesque rhoncus libero, vitae faucibus massa molestie in. Integer iaculis interdum sapien iaculis malesuada. Nulla sed fringilla dui. Aliquam iaculis est mi, vel hendrerit risus imperdiet ornare. Nulla nec rutrum libero, ut gravida purus. Integer nec imperdiet lacus. Fusce varius lorem quis blandit consectetur. Duis tempor varius tellus, sit amet ornare ipsum sollicitudin nec. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam elementum laoreet felis, ac convallis ligula varius eu.";

    const chatHistory = [
      {
        message: {
          role: "user" as const,
          content: longMessage,
        },
        contextItems: [],
      },
    ];

    const terminalWidth = 80;
    const messageRows = processHistoryToMessageRows(chatHistory, terminalWidth);

    console.log("DEBUG: MessageRows for long user message:");
    messageRows.forEach((row, index) => {
      console.log(`Row ${index}:`, {
        role: row.role,
        showBullet: row.showBullet,
        marginBottom: row.marginBottom,
        text:
          row.segments
            .map((s) => s.text)
            .join("")
            .slice(0, 60) + "...",
      });
    });

    // Verify only first row has bullet
    expect(messageRows.length).toBeGreaterThan(1);
    expect(messageRows[0].showBullet).toBe(true);
    messageRows.slice(1, -1).forEach((row) => {
      expect(row.showBullet).toBe(false);
      expect(row.marginBottom).toBe(0);
    });
    expect(messageRows[messageRows.length - 1].showBullet).toBe(false);
    expect(messageRows[messageRows.length - 1].marginBottom).toBe(1);
  });

  it("should debug output for a real-world case", () => {
    const chatHistory = [
      {
        message: {
          role: "user" as const,
          content:
            "Can you help me write a function that takes a list of numbers and returns the sum? Please make sure to handle edge cases.",
        },
        contextItems: [],
      },
    ];

    const terminalWidth = 80;
    const messageRows = processHistoryToMessageRows(chatHistory, terminalWidth);

    console.log("DEBUG: MessageRows for user message:");
    messageRows.forEach((row, index) => {
      console.log(`Row ${index}:`, {
        role: row.role,
        showBullet: row.showBullet,
        marginBottom: row.marginBottom,
        text: row.segments.map((s) => s.text).join(""),
      });
    });

    // This message gets split into 2 rows due to terminal width and the -6 character adjustment
    expect(messageRows.length).toBe(2);
    expect(messageRows[0].showBullet).toBe(true);
    expect(messageRows[0].marginBottom).toBe(0); // No margin on continuation
    expect(messageRows[1].showBullet).toBe(false); // No bullet on continuation
    expect(messageRows[1].marginBottom).toBe(1); // Margin on last row
  });
});
