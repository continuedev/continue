import { Box, Text } from "ink";
import React from "react";

import { logger } from "src/util/logger.js";

import { listSessions, type ExtendedSessionMetadata } from "../../session.js";
import { SessionSelector } from "../SessionSelector.js";

interface SessionSelectorWithLoadingProps {
  onSelect: (sessionId: string) => Promise<void>;
  onExit: () => void;
}

export const SessionSelectorWithLoading: React.FC<
  SessionSelectorWithLoadingProps
> = ({ onSelect, onExit }) => {
  const [sessions, setSessions] = React.useState<ExtendedSessionMetadata[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      try {
        if (!isMounted) return;
        setIsLoading(true);
        const sessionList = await listSessions();
        if (!isMounted) return;
        setSessions(sessionList);
      } catch (error) {
        if (!isMounted) return;
        logger.error("Error loading sessions:", error);
        setSessions([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <Box paddingX={1} borderStyle="round" borderColor="blue">
        <Text color="blue">Loading sessions...</Text>
      </Box>
    );
  }

  return (
    <SessionSelector sessions={sessions} onSelect={onSelect} onExit={onExit} />
  );
};
