import { format, isThisWeek, isThisYear, isToday, isYesterday } from "date-fns";
import { Box, Text, useInput } from "ink";
import React, { useMemo, useState } from "react";

import { SessionMetadata } from "../session.js";

import { useTerminalSize } from "./hooks/useTerminalSize.js";
import { defaultBoxStyles } from "./styles.js";

interface SessionSelectorProps {
  sessions: SessionMetadata[];
  onSelect: (sessionId: string) => void;
  onExit: () => void;
}

function formatTimestamp(date: Date): string {
  if (isToday(date)) {
    return format(date, "h:mm a");
  } else if (isYesterday(date)) {
    return "yesterday";
  } else if (isThisWeek(date)) {
    return format(date, "EEEE"); // Day name (e.g., "Monday")
  } else if (isThisYear(date)) {
    return format(date, "MMM d"); // e.g., "Jan 15"
  } else {
    return format(date, "MMM d, yyyy"); // e.g., "Jan 15, 2023"
  }
}

function formatMessage(message: string | undefined): string {
  if (!message) return "(no messages)";
  // Ensure we're working with a string, handle edge cases from persisted data
  const messageStr = typeof message === "string" ? message : String(message);
  return messageStr.split("\n")[0];
}

export function SessionSelector({
  sessions,
  onSelect,
  onExit,
}: SessionSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { rows: terminalHeight } = useTerminalSize();

  // Calculate how many sessions we can display based on terminal height
  const displaySessions = useMemo(() => {
    // Reserve 5 lines for header and instructions, each session takes 3 lines (2 content + 1 spacer)
    const availableHeight = Math.max(1, terminalHeight - 5);
    const maxDisplayableSessions = Math.floor(availableHeight / 3);

    return sessions.slice(0, maxDisplayableSessions);
  }, [sessions, terminalHeight]);

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
        onSelect(displaySessions[selectedIndex].sessionId);
      }
    } else if (key.escape || (key.ctrl && input === "d")) {
      onExit();
    }
  });

  if (sessions.length === 0) {
    return (
      <Box {...defaultBoxStyles("blue")}>
        <Text color="yellow">No previous sessions found.</Text>
        <Text color="gray">Start a new conversation with: cn</Text>
        <Text color="gray">Press Esc to exit</Text>
      </Box>
    );
  }

  return (
    <Box {...defaultBoxStyles("blue")}>
      <Text color="blue" bold>
        Recent Sessions
      </Text>
      <Text color="gray">↑/↓ to navigate, Enter to select, Esc to exit</Text>
      <Text> </Text>

      {displaySessions.map((session, index) => {
        const isSelected = index === selectedIndex;
        const indicator = isSelected ? "➤ " : "  ";
        const color = isSelected ? "blue" : "white";

        return (
          <Box key={session.sessionId} flexDirection="column">
            <Box paddingRight={3}>
              <Text bold={isSelected} color={color} wrap="truncate-end">
                {indicator}
                {formatMessage(session.title)}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="gray">
                {formatTimestamp(new Date(session.dateCreated))}
              </Text>
            </Box>
            {index < displaySessions.length - 1 && (
              <Text key={`spacer-${session.sessionId}`}> </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
