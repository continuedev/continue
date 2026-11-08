import { Box, Text } from "ink";
import React from "react";

import type { QueuedMessage } from "../../stream/messageQueue.js";

interface QueuedMessagesProps {
  items: QueuedMessage[];
  paused?: boolean;
  steerRequested?: boolean;
  /** The highlighted message, which + / - / Delete / Enter act on */
  selectedId?: string | null;
  /** A message on its way to the model while compaction runs ahead of it. */
  pendingMessage?: string | null;
}

function queueHint(
  paused: boolean,
  steerRequested: boolean,
  selecting: boolean,
): string {
  if (selecting) return "+/- move · Del remove · Enter edit · Esc back";
  if (steerRequested)
    return "sending after the current tool calls · Enter again to steer now";
  if (paused) return "paused · Enter to send · ↑ to edit";
  return "sent when the turn ends · Enter on empty prompt to send now · ↑ to edit · ↓ to reorder";
}

/**
 * The queue as it will be sent: numbered, oldest first. Rendered from the
 * queue itself, so it cannot show a message that will not be sent or hide
 * one that will.
 */
export const QueuedMessages: React.FC<QueuedMessagesProps> = ({
  items,
  paused = false,
  steerRequested = false,
  selectedId = null,
  pendingMessage,
}) => {
  if (items.length === 0 && !pendingMessage) return null;

  return (
    <Box flexDirection="column" paddingLeft={2} paddingBottom={1}>
      {pendingMessage ? (
        <Text color="dim" italic>
          {pendingMessage}
        </Text>
      ) : null}
      {items.length > 0 ? (
        <>
          <Text color="dim">
            Queued ({items.length}) ·{" "}
            {queueHint(paused, steerRequested, selectedId !== null)}
          </Text>
          {items.map((item, index) =>
            item.id === selectedId ? (
              <Text key={item.id} color="cyan" bold>
                › {index + 1}. {item.message}
              </Text>
            ) : (
              <Text key={item.id} color="dim" italic>
                {index + 1}. {item.message}
              </Text>
            ),
          )}
        </>
      ) : null}
    </Box>
  );
};
