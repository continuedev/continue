import {
  ContentBlockParam,
  MessageCreateParams,
  MessageParam,
} from "@anthropic-ai/sdk/resources";
import {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
} from "openai/resources/index";

import {
  CACHING_STRATEGIES,
  CachingStrategyName,
} from "./AnthropicCachingStrategies.js";
import {
  addCacheControlToLastTwoUserMessages,
  openaiToolToAnthropicTool,
} from "./AnthropicUtils.js";

interface SystemMapping {
  openaiIndex: number;
  start: number;
  length: number;
  wasString: boolean;
  originalContent: ChatCompletionMessageParam["content"];
  textPartIndices: (number | null)[];
}

interface MessageMapping {
  openaiIndex: number;
  anthropicIndex: number;
  role: string;
  wasString: boolean;
  originalContent: ChatCompletionMessageParam["content"];
  textPartIndices: (number | null)[];
}

interface ConversionResult {
  anthropicBody: MessageCreateParams;
  systemMappings: SystemMapping[];
  messageMappings: MessageMapping[];
}

const convertContentToBlocks = (
  content: ChatCompletionMessageParam["content"],
): {
  blocks: ContentBlockParam[];
  textPartIndices: (number | null)[];
  wasString: boolean;
} => {
  if (typeof content === "string" || typeof content === "number") {
    const text = String(content);
    return {
      blocks: [
        {
          type: "text",
          text,
        } as ContentBlockParam,
      ],
      textPartIndices: [null],
      wasString: true,
    };
  }

  if (!Array.isArray(content)) {
    return {
      blocks: [],
      textPartIndices: [],
      wasString: false,
    };
  }

  const blocks: ContentBlockParam[] = [];
  const textPartIndices: (number | null)[] = [];

  content.forEach((part: any, idx: number) => {
    if (part?.type === "text") {
      blocks.push({
        type: "text",
        text: part.text ?? "",
      } as ContentBlockParam);
      textPartIndices.push(idx);
    } else {
      blocks.push({ ...(part ?? {}) } as any);
      textPartIndices.push(null);
    }
  });

  return {
    blocks,
    textPartIndices,
    wasString: false,
  };
};

const convertToAnthropic = (
  body: ChatCompletionCreateParams,
): ConversionResult => {
  const systemBlocks: ContentBlockParam[] = [];
  const systemMappings: SystemMapping[] = [];
  const messages: MessageParam[] = [];
  const messageMappings: MessageMapping[] = [];

  let systemOffset = 0;

  body.messages.forEach((message, index) => {
    const { blocks, textPartIndices, wasString } = convertContentToBlocks(
      message.content,
    );

    if (message.role === "system") {
      const length = blocks.length;
      systemMappings.push({
        openaiIndex: index,
        start: systemOffset,
        length,
        wasString,
        originalContent: message.content,
        textPartIndices,
      });
      systemBlocks.push(...blocks);
      systemOffset += length;
    } else {
      messages.push({
        role: message.role as MessageParam["role"],
        content: blocks as any,
      });
      messageMappings.push({
        openaiIndex: index,
        anthropicIndex: messages.length - 1,
        role: message.role,
        wasString,
        originalContent: message.content,
        textPartIndices,
      });
    }
  });

  const tools = body.tools
    ?.filter((tool) => tool.type === "function")
    .map((tool) => openaiToolToAnthropicTool(tool));

  const anthropicBody: MessageCreateParams = {
    model: body.model,
    messages,
    max_tokens: body.max_tokens ?? 1,
    system: systemBlocks.length > 0 ? (systemBlocks as any) : undefined,
    tools,
  };

  return { anthropicBody, systemMappings, messageMappings };
};

export const applyAnthropicCachingToOpenRouterBody = (
  body: ChatCompletionCreateParams,
  strategy: CachingStrategyName,
): void => {
  const { anthropicBody, systemMappings, messageMappings } =
    convertToAnthropic(body);

  const cachingStrategy =
    CACHING_STRATEGIES[strategy] ?? CACHING_STRATEGIES.systemAndTools;
  const cachedBody = cachingStrategy({ ...anthropicBody });

  cachedBody.messages = cachedBody.messages ?? [];
  addCacheControlToLastTwoUserMessages(cachedBody.messages);

  const cachedSystem = Array.isArray(cachedBody.system)
    ? cachedBody.system
    : [];

  systemMappings.forEach((mapping) => {
    const openaiMessage = body.messages[mapping.openaiIndex] as any;
    if (!openaiMessage) {
      return;
    }

    const slice = cachedSystem.slice(
      mapping.start,
      mapping.start + mapping.length,
    );
    const hasCache = slice.some((block: any) => block?.cache_control);

    if (!hasCache) {
      openaiMessage.content = mapping.originalContent;
      return;
    }

    if (mapping.wasString) {
      openaiMessage.content = slice.map((block: any) => ({
        type: "text",
        text: block?.text ?? "",
        ...(block?.cache_control ? { cache_control: block.cache_control } : {}),
      }));
      return;
    }

    if (Array.isArray(mapping.originalContent)) {
      const newParts = mapping.originalContent.map((part: any) => ({
        ...part,
      }));

      slice.forEach((block: any, idx: number) => {
        const originalIndex = mapping.textPartIndices[idx];
        if (
          originalIndex === null ||
          originalIndex === undefined ||
          !block?.cache_control
        ) {
          return;
        }

        newParts[originalIndex] = {
          ...newParts[originalIndex],
          cache_control: block.cache_control,
          ...(block.text !== undefined ? { text: block.text } : {}),
        };
      });

      openaiMessage.content = newParts;
    }
  });

  const cachedMessages = cachedBody.messages ?? [];
  messageMappings.forEach((mapping) => {
    const openaiMessage = body.messages[mapping.openaiIndex] as any;
    const cachedMessage = cachedMessages[mapping.anthropicIndex] as any;
    if (!openaiMessage || !cachedMessage) {
      return;
    }

    if (cachedMessage.role !== "user") {
      openaiMessage.content = mapping.originalContent;
      return;
    }

    const contentArray = Array.isArray(cachedMessage.content)
      ? cachedMessage.content
      : [];
    const hasCache = contentArray.some((block: any) => block?.cache_control);

    if (!hasCache) {
      openaiMessage.content = mapping.originalContent;
      return;
    }

    if (mapping.wasString) {
      openaiMessage.content = contentArray.map((block: any) => ({
        type: "text",
        text: block?.text ?? "",
        ...(block?.cache_control ? { cache_control: block.cache_control } : {}),
      }));
      return;
    }

    if (Array.isArray(mapping.originalContent)) {
      const newParts = mapping.originalContent.map((part: any) => ({
        ...part,
      }));

      contentArray.forEach((block: any, idx: number) => {
        const originalIndex = mapping.textPartIndices[idx];
        if (
          originalIndex === null ||
          originalIndex === undefined ||
          !block?.cache_control
        ) {
          return;
        }

        newParts[originalIndex] = {
          ...newParts[originalIndex],
          cache_control: block.cache_control,
          ...(block.text !== undefined ? { text: block.text } : {}),
        };
      });

      openaiMessage.content = newParts;
    }
  });

  if (body.tools?.length && cachedBody.tools?.length) {
    body.tools = body.tools.map((tool, idx) => {
      const cachedTool = (cachedBody.tools ?? [])[idx] as any;
      if (!cachedTool?.cache_control) {
        return tool;
      }
      return {
        ...tool,
        cache_control: cachedTool.cache_control,
      } as any;
    });
  }
};
