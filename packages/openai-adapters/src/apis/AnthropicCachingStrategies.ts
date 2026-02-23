import { MessageCreateParams } from "@anthropic-ai/sdk/resources";

const MAX_CACHING_MESSAGES = 4;

// Caching strategy type - transforms a clean Anthropic body by adding cache_control
export type CachingStrategy = (
  anthropicBody: MessageCreateParams,
) => MessageCreateParams;

// Utility function to estimate token count
const estimateTokenCount = (text: string): number => Math.ceil(text.length / 4);

// Strategy 1: No Caching
const noCachingStrategy: CachingStrategy = (body) => body;

// Strategy 2: System Messages Only
const systemOnlyStrategy: CachingStrategy = (body) => {
  let availableCacheMessages = MAX_CACHING_MESSAGES;
  if (body.system && Array.isArray(body.system)) {
    return {
      ...body,
      system: body.system.map((item) => {
        if (availableCacheMessages > 0) {
          availableCacheMessages -= 1;
          return {
            ...item,
            cache_control: { type: "ephemeral" },
          };
        }
        return item;
      }),
    };
  }
  return body;
};

// Strategy 3: System and Tools (High Impact)
const systemAndToolsStrategy: CachingStrategy = (body) => {
  const result = { ...body };
  let availableCacheMessages = MAX_CACHING_MESSAGES;

  // Cache system messages
  if (result.system && Array.isArray(result.system)) {
    result.system = result.system.map((item) => {
      if (availableCacheMessages > 0) {
        availableCacheMessages -= 1;
        return {
          ...item,
          cache_control: { type: "ephemeral" },
        };
      }
      return item;
    });
  }

  // Cache tool definitions
  if (result.tools && Array.isArray(result.tools) && result.tools.length > 0) {
    result.tools = result.tools.map((tool, index: number) => {
      if (index === result.tools!.length - 1 && availableCacheMessages > 0) {
        availableCacheMessages -= 1;
        return {
          ...tool,
          cache_control: { type: "ephemeral" },
        };
      }
      return tool;
    });
  }

  return result;
};

// Strategy 4: Optimized (Intelligent Caching)
const optimizedStrategy: CachingStrategy = (body) => {
  const result = { ...body };
  let availableCacheMessages = MAX_CACHING_MESSAGES;

  // Always cache system messages
  if (result.system && Array.isArray(result.system)) {
    result.system = result.system.map((item) => {
      if (availableCacheMessages > 0) {
        availableCacheMessages -= 1;
        return {
          ...item,
          cache_control: { type: "ephemeral" },
        };
      }
      return item;
    });
  }

  // Cache tool definitions
  if (result.tools && Array.isArray(result.tools) && result.tools.length > 0) {
    result.tools = result.tools.map((tool, index: number) => {
      if (index === result.tools!.length - 1 && availableCacheMessages > 0) {
        availableCacheMessages -= 1;
        return {
          ...tool,
          cache_control: { type: "ephemeral" },
        };
      }
      return tool;
    });
  }

  // Cache large messages (>500 tokens)
  if (result.messages && Array.isArray(result.messages)) {
    result.messages = result.messages.map((message) => {
      if (message.content && typeof message.content === "string") {
        const tokens = estimateTokenCount(message.content);
        if (tokens > 500 && availableCacheMessages > 0) {
          availableCacheMessages -= 1;
          return {
            ...message,
            content: [
              {
                type: "text",
                text: message.content,
                cache_control: { type: "ephemeral" as const },
              },
            ],
          };
        }
      } else if (message.content && Array.isArray(message.content)) {
        // Only add one cache control per message with array content
        let addedCacheControl = false;
        const updatedContent = message.content.map((item) => {
          if (item.type === "text" && item.text) {
            const tokens = estimateTokenCount(item.text);
            if (
              tokens > 500 &&
              availableCacheMessages > 0 &&
              !addedCacheControl
            ) {
              availableCacheMessages -= 1;
              addedCacheControl = true;
              return {
                ...item,
                cache_control: { type: "ephemeral" as const },
              };
            }
          }
          return item;
        });

        return {
          ...message,
          content: updatedContent,
        };
      }
      return message;
    });
  }

  return result;
};

// Available caching strategies
export const CACHING_STRATEGIES = {
  none: noCachingStrategy,
  systemOnly: systemOnlyStrategy,
  systemAndTools: systemAndToolsStrategy,
  optimized: optimizedStrategy,
} as const;

export type CachingStrategyName = keyof typeof CACHING_STRATEGIES;

// Helper function to get available strategies
export const getAvailableStrategies = () => {
  return Object.keys(CACHING_STRATEGIES) as CachingStrategyName[];
};

// Helper function to get strategy description
export const getStrategyDescription = (
  strategy: CachingStrategyName,
): string => {
  const descriptions = {
    none: "No caching - baseline for comparison",
    systemOnly: "Cache only system messages (current implementation)",
    systemAndTools: "Cache system messages and tool definitions (high impact)",
    optimized:
      "Intelligent caching - system, tools, and large content (best performance)",
  };
  return descriptions[strategy];
};
