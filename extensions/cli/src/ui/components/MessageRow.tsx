import { Box, Text } from "ink";
import React from "react";

import type { MessageRow } from "../types/messageTypes.js";

import { StyledSegmentRenderer } from "./StyledText.js";

/**
 * Unified MessageRow component - single rendering path for all message types
 *
 * Replaces MemoizedMessage.tsx with simplified logic:
 * - No conditional rendering paths
 * - Always renders segments
 * - Uses MessageRow.showBullet and MessageRow.marginBottom for formatting
 */
export function MessageRowComponent({
  row,
}: {
  row: MessageRow;
}): React.ReactElement {
  return (
    <Box marginBottom={row.marginBottom}>
      {/* Only render bullet area for user/assistant messages, not tool results */}
      {row.role !== "tool-result" && (
        <>
          <Text color={row.role === "user" ? "blue" : "white"}>
            {row.showBullet ? "●" : " "}
          </Text>
          <Text> </Text>
        </>
      )}
      <StyledSegmentRenderer segments={row.segments} />
    </Box>
  );
}
