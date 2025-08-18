import { Box, Text, useInput } from "ink";
import React, { useMemo, useState } from "react";

import { SessionMetadata } from "../session.js";

interface SessionSelectorProps {
  sessions: SessionMetadata[];
  onSelect: (sessionId: string) => void;
  onExit: () => void;
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function formatMessage(message: string | undefined): string {
  if (!message) return "(no messages)";
  return message.split("\n")[0];
}

function getTerminalHeight(): number {
  // Default to reasonable fallback if we can't detect
  return process.stdout.rows || 25;
}

export function SessionSelector({
  sessions,
  onSelect,
  onExit,
}: SessionSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Calculate how many sessions we can display based on terminal height
  const displaySessions = useMemo(() => {
    const terminalHeight = getTerminalHeight();
    // Reserve 5 lines for header and instructions, each session takes 3 lines (2 content + 1 spacer)
    const availableHeight = Math.max(1, terminalHeight - 5);
    const maxDisplayableSessions = Math.floor(availableHeight / 3);

    return sessions.slice(0, maxDisplayableSessions);
  }, [sessions]);

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : displaySessions.length - 1,
      );
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((prev) =>
        prev < displaySessions.length - 1 ? prev + 1 : 0,
      );
    } else if (key.return) {
      if (displaySessions[selectedIndex]) {
        onSelect(displaySessions[selectedIndex].id);
      }
    } else if (key.escape || (key.ctrl && input === "c")) {
      onExit();
    }
  });

  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">No previous sessions found.</Text>
        <Text color="gray">Start a new conversation with: cn</Text>
        <Text color="gray">Press ESC to exit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="blue" bold>
        Recent Sessions
      </Text>
      <Text color="gray">
        Use ↑↓ arrows to navigate, Enter to select, ESC to exit
      </Text>
      <Text> </Text>

      {displaySessions.map((session, index) => {
        const isSelected = index === selectedIndex;
        const indicator = isSelected ? "► " : "  ";
        const color = isSelected ? "cyan" : "white";

        return (
          <Box key={`session-${session.id}`} flexDirection="column">
            <Box paddingRight={3}>
              <Text color={color} wrap="truncate-end">
                {indicator}
                {formatMessage(session.firstUserMessage)}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="gray">
                {formatTimestamp(session.timestamp)} - {session.messageCount}{" "}
                messages
              </Text>
            </Box>
            {index < displaySessions.length - 1 && (
              <Text key={`spacer-${index}`}> </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
