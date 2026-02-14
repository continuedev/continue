/**
 * Validation utilities for DeepSeek API requests
 */

/**
 * Filters message content to only include text parts
 */
export function validateAndFilterContent(
  content: any,
  warnings: string[] = [],
): string | Array<{ type: "text"; text: string }> | null {
  if (Array.isArray(content)) {
    const filtered = content.filter((part) => {
      return part.type === "text";
    });

    if (filtered.length !== content.length) {
      warnings.push("Non-text content parts were filtered out");
    }

    return filtered.length > 0 ? filtered : "";
  }

  return content;
}

/**
 * Validates the response format parameter
 */
export function validateResponseFormat(
  responseFormat: any,
  warnings: string[] = [],
): { type: "text" | "json_object" } | undefined {
  if (!responseFormat || !responseFormat.type) return undefined;

  if (!["text", "json_object"].includes(responseFormat.type)) {
    warnings.push(
      `Invalid response_format.type: ${responseFormat.type}. Must be 'text' or 'json_object'.`,
    );
    return undefined;
  }

  return responseFormat;
}

/**
 * Validates the top_logprobs parameter
 */
export function validateLogprobs(
  logprobs: boolean | null | undefined,
  top_logprobs: number | null | undefined,
  isReasoning: boolean,
  warnings: string[],
): {
  logprobs: boolean | null | undefined;
  top_logprobs: number | null | undefined;
} {
  if (isReasoning) {
    if (logprobs !== undefined) {
      warnings.push("logprobs is not supported for deepseek reasoner models.");
    }

    if (top_logprobs !== undefined) {
      warnings.push(
        "top_logprobs is not supported for deepseek reasoner models.",
      );
    }

    return { top_logprobs: undefined, logprobs: undefined };
  }

  return { logprobs: logprobs, top_logprobs: top_logprobs };
}

/**
 * Validates and prepares tools for the API request
 */
export function validateAndFilterTools(
  tools: any[] | undefined,
  warnings: string[] = [],
): any[] | undefined {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return undefined;
  }

  let numberOfTools = tools.length;
  let filteredTools = tools.filter((tool) => tool.type === "function");

  if (numberOfTools !== filteredTools.length) {
    warnings.push(
      `DeepSeek API supports only function tools. Ignoring ${numberOfTools - filteredTools.length} tools.`,
    );
  }

  if (filteredTools.length > 128) {
    warnings.push(
      `DeepSeek API supports maximum 128 tools. Using first 128 and ignoring ${filteredTools.length - 128} tools.`,
    );
    tools = tools.slice(0, 127);
  }

  return filteredTools;
}

/**
 * Validates and processes stop sequences
 */
export function validateStopSequences(
  stop: string | string[] | null | undefined,
  warnings: string[],
): string | string[] | undefined {
  if (!stop) return undefined;

  if (Array.isArray(stop) && stop.length > 16) {
    warnings.push(
      `DeepSeek API supports maximum 16 stop sequences. Got ${stop.length}. Using first 16.`,
    );
    return stop.slice(0, 16);
  }

  return stop;
}

// FIM-specific validation functions

/**
 * Validates the prompt parameter for FIM completion
 */
export function validateFimPrompt(
  prompt: any,
  warnings: string[] = [],
): string {
  if (prompt === null || prompt === undefined || prompt === "") {
    throw new Error("FIM completion requires a prompt");
  }

  const promptText = Array.isArray(prompt) ? prompt.join(" ") : prompt;

  if (!promptText.trim()) {
    throw new Error("FIM prompt cannot be empty");
  }

  return promptText;
}

/**
 * Validates and converts the tool_choice parameter to DeepSeek format
 */
export function validateToolChoice(
  toolChoice: any,
  warnings: string[] = [],
):
  | "none"
  | "auto"
  | "required"
  | { type: "function"; function: { name: string } }
  | undefined {
  if (!toolChoice) return undefined;

  // Handle string values
  if (typeof toolChoice === "string") {
    if (
      toolChoice === "none" ||
      toolChoice === "auto" ||
      toolChoice === "required"
    ) {
      return toolChoice as "none" | "auto" | "required";
    }
    warnings.push(
      `Unsupported tool_choice value: ${toolChoice}. Must be one of: 'none', 'auto', 'required'`,
    );
    return undefined;
  }

  // Handle object format { type: 'function', function: { name: string } }
  if (
    typeof toolChoice === "object" &&
    toolChoice.type === "function" &&
    toolChoice.function?.name
  ) {
    return toolChoice as { type: "function"; function: { name: string } };
  }

  warnings.push(
    `Invalid tool_choice format: ${JSON.stringify(toolChoice)}. Must be one of: 'none', 'auto', 'required' or ChatCompletionNamedToolChoice`,
  );
  return undefined;
}

/**
 * Validates prefix completion requirements
 */
export function validateChatPrefixCompletion(
  messages: any[],
  warnings: string[] = [],
): void {
  if (!messages || messages.length === 0) {
    warnings.push("Prefix completion requires at least one message");
    return;
  }

  const lastMessage = messages[messages.length - 1];

  if (lastMessage.role !== "assistant") {
    throw new Error(
      'Prefix completion requires the last message to have role "assistant"',
    );
  }

  if (!lastMessage.prefix) {
    throw new Error(
      'Prefix completion requires the last message to have "prefix: true"',
    );
  }

  if (!lastMessage.content || lastMessage.content.trim() === "") {
    warnings.push(
      "Prefix completion requires the assistant message to have non-empty content",
    );
  }
}
