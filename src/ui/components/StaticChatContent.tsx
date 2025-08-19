import type { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { Static, useStdout } from "ink";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { MCPService } from "../../services/MCPService.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { IntroMessage } from "../IntroMessage.js";
import type { DisplayMessage } from "../types.js";

interface StaticChatContentProps {
  showIntroMessage: boolean;
  config?: AssistantUnrolled;
  model?: ModelConfig;
  mcpService?: MCPService;
  messages: DisplayMessage[];
  renderMessage: (message: DisplayMessage, index: number) => React.ReactElement;
}

export const StaticChatContent: React.FC<StaticChatContentProps> = ({
  showIntroMessage,
  config,
  model,
  mcpService,
  messages,
  renderMessage,
}) => {
  const { columns, rows } = useTerminalSize();
  const { stdout } = useStdout();

  // State for managing static refresh with key-based remounting (gemini-cli approach)
  const [staticKey, setStaticKey] = useState(0);
  const isInitialMount = useRef(true);

  // Refresh function that clears terminal and remounts Static component
  const refreshStatic = useCallback(() => {
    // Clear terminal completely before remounting
    stdout.write("\x1b[2J\x1b[H");
    setStaticKey((prev) => prev + 1);
  }, [stdout]);

  // Debounced terminal resize handler (300ms like gemini-cli)
  useEffect(() => {
    // Skip refreshing Static during first mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Debounce so it doesn't fire too often during resize
    const handler = setTimeout(() => {
      refreshStatic();
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [columns, rows, refreshStatic]);

  // Create static items array (similar to gemini-cli's approach)
  const staticItems = React.useMemo(() => {
    const items: React.ReactElement[] = [];

    // Add intro message as first item if it should be shown
    if (showIntroMessage && config && model && mcpService) {
      items.push(
        <IntroMessage
          key="intro"
          config={config}
          model={model}
          mcpService={mcpService}
        />,
      );
    }

    // Add all chat messages
    messages.forEach((message, index) => {
      items.push(renderMessage(message, index));
    });

    return items;
  }, [showIntroMessage, config, model, mcpService, messages, renderMessage]);

  return (
    <Static
      key={staticKey}
      items={staticItems}
      style={{
        width: columns - 1,
        textWrap: "wrap",
      }}
    >
      {(item) => item}
    </Static>
  );
};
