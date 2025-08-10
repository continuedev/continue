import type { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { Static } from "ink";
import React from "react";

import type { MCPService } from "../../mcp.js";
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
  // Create a combined array of items to render
  const staticItems = React.useMemo(() => {
    const items: Array<{
      type: "intro" | "message";
      data: DisplayMessage | null;
      index?: number;
    }> = [];

    // Add intro message as first item if it should be shown
    if (showIntroMessage && config && model && mcpService) {
      items.push({ type: "intro", data: null });
    }

    // Add all chat messages
    messages.forEach((message, index) => {
      items.push({ type: "message", data: message, index });
    });

    return items;
  }, [showIntroMessage, config, model, mcpService, messages]);

  return (
    <Static items={staticItems}>
      {(item) => {
        if (item.type === "intro" && config && model && mcpService) {
          return (
            <IntroMessage
              key="intro"
              config={config}
              model={model}
              mcpService={mcpService}
            />
          );
        } else if (
          item.type === "message" &&
          item.data &&
          item.index !== undefined
        ) {
          return renderMessage(item.data, item.index);
        }
        return null;
      }}
    </Static>
  );
};
