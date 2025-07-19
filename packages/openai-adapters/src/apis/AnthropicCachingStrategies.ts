// Caching strategy type - transforms a clean Anthropic body by adding cache_control
export type CachingStrategy = (anthropicBody: any) => any;

// Utility function to estimate token count
const estimateTokenCount = (text: string): number => Math.ceil(text.length / 4);

// Strategy 1: No Caching (Baseline)
const noCachingStrategy: CachingStrategy = (body) => body;

// Strategy 2: System Messages Only (Current Implementation)
const systemOnlyStrategy: CachingStrategy = (body) => {
  if (body.system && Array.isArray(body.system)) {
    return {
      ...body,
      system: body.system.map((item: any) => ({
        ...item,
        cache_control: { type: "ephemeral" },
      })),
    };
  }
  return body;
};

// Strategy 3: System and Tools (High Impact)
const systemAndToolsStrategy: CachingStrategy = (body) => {
  const result = { ...body };

  // Cache system messages
  if (result.system && Array.isArray(result.system)) {
    result.system = result.system.map((item: any) => ({
      ...item,
      cache_control: { type: "ephemeral" },
    }));
  }

  // Cache tool definitions
  if (result.tools && Array.isArray(result.tools) && result.tools.length > 0) {
    result.tools = result.tools.map((tool: any, index: number) => {
      if (index === result.tools.length - 1) {
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

  // Always cache system messages
  if (result.system && Array.isArray(result.system)) {
    result.system = result.system.map((item: any) => ({
      ...item,
      cache_control: { type: "ephemeral" },
    }));
  }

  // Cache tool definitions
  if (result.tools && Array.isArray(result.tools) && result.tools.length > 0) {
    result.tools = result.tools.map((tool: any, index: number) => {
      if (index === result.tools.length - 1) {
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
    result.messages = result.messages.map((message: any) => {
      if (message.content && typeof message.content === "string") {
        const tokens = estimateTokenCount(message.content);
        if (tokens > 500) {
          return {
            ...message,
            content: [
              {
                type: "text",
                text: message.content,
                cache_control: { type: "ephemeral" },
              },
            ],
          };
        }
      } else if (message.content && Array.isArray(message.content)) {
        const updatedContent = message.content.map((item: any) => {
          if (item.type === "text" && item.text) {
            const tokens = estimateTokenCount(item.text);
            if (tokens > 500) {
              return {
                ...item,
                cache_control: { type: "ephemeral" },
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
