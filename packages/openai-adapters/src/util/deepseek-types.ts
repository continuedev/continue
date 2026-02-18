/**
 * Core request body interface shared across different API endpoints
 */
export interface BaseDeepSeekRequestBody {
  model: string;
  max_tokens?: number | null;
  temperature?: number | null;
  top_p?: number | null;
  frequency_penalty?: number | null;
  presence_penalty?: number | null;
  stop?: string | string[] | null;
  stream?: boolean | null;
}

/**
 * DeepSeek tool type (function tool only)
 */
export type DeepSeekTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: any;
    strict?: boolean;
  };
};

/**
 * DeepSeek tool choice type
 */
export type DeepSeekToolChoice =
  | "none"
  | "auto"
  | "required"
  | { type: "function"; function: { name: string } };

/**
 * DeepSeek response format type
 */
export type DeepSeekResponseFormat = {
  type: "text" | "json_object";
};

/**
 * Interface for chat completion request body
 */
export interface ChatDeepSeekRequestBody extends BaseDeepSeekRequestBody {
  messages: DeepSeekMessage[];
  thinking?: { type: "enabled" | "disabled" } | null;
  tool_choice?: DeepSeekToolChoice | null;
  tools?: DeepSeekTool[] | null;
  response_format?: DeepSeekResponseFormat | null;
  stream_options?: {
    include_usage?: boolean;
  } | null;
  logprobs?: boolean | null;
  top_logprobs?: number | null;
}

/**
 * Interface for prefix completion request body
 *
 * Note: This is a beta endpoint that shares parameters with chat completion,
 * but requires the last message to have role: 'assistant' and prefix: true
 */
// export interface ChatPrefixDeepSeekRequestBody extends ChatDeepSeekRequestBody {}

/**
 * Interface for Fill-in-Middle (FIM) completion request body
 */
export interface FimDeepSeekRequestBody extends BaseDeepSeekRequestBody {
  prompt: string;
  suffix?: string | null;
  echo?: boolean | null;
  logprobs?: number | null;
  stream_options?: {
    include_usage?: boolean;
  } | null;
}

/**
 * Interface for a message in a chat completion request body
 */
export interface DeepSeekMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: "text"; text: string }> | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: DeepSeekToolCall[];
  prefix?: boolean; // assistant messages only
  reasoning_content?: string | null; // assistant messages only
}

/**
 * Tool call interface for DeepSeek API responses
 */
export interface DeepSeekToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Logprobs interface for chat completions
 */
export interface ChatLogprobsResponse {
  content: Array<{
    token: string;
    logprob: number;
    bytes?: number[] | null;
    top_logprobs?: Array<{
      token: string;
      logprob: number;
      bytes?: number[] | null;
    }>;
  }> | null;
  reasoning_content?: Array<{
    token: string;
    logprob: number;
    bytes?: number[] | null;
    top_logprobs?: Array<{
      token: string;
      logprob: number;
      bytes?: number[] | null;
    }>;
  }> | null;
}

/**
 * Usage interface for DeepSeek API responses
 */
export interface UsageDeepSeekResponse {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

/**
 * DeepSeek API error response interface
 */
export interface ErrorDeepSeekResponse {
  error: {
    message: string;
    type?: string;
    param?: string | null;
    code?: number | null;
    details?: any;
  };
}

/**
 * Base interface for all DeepSeek API responses
 */
export interface BaseDeepSeekResponseBody {
  id: string;
  created: number;
  model: string;
  object: string; // static string for each response type
  system_fingerprint?: string; // Required – Optional only for FIM stream chunks (official docs)
}

/**
 * DeepSeek API success response interface for chat completions
 */
export interface ChatDeepSeekResponseBody extends BaseDeepSeekResponseBody {
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      reasoning_content?: string | null;
      tool_calls?: DeepSeekToolCall[];
    };
    finish_reason: string;
    logprobs?: ChatLogprobsResponse | null;
  }>;
  usage?: UsageDeepSeekResponse;
}

/**
 * DeepSeek API success response interface for FIM completions
 */
export interface FimDeepSeekResponseBody extends BaseDeepSeekResponseBody {
  choices: Array<{
    text: string;
    index: number;
    logprobs: {
      text_offset?: number[];
      token_logprobs?: number[];
      tokens?: string[];
      top_logprobs?: Array<Record<string, number>>;
    } | null;
    finish_reason: string;
  }>;
  usage?: UsageDeepSeekResponse;
}

/**
 * DeepSeek streaming chunk interface for chat completions
 */
export interface ChatDeepSeekStreamChunk extends BaseDeepSeekResponseBody {
  choices: Array<{
    index: number;
    delta: {
      role?: string; // possible values: "assistant"
      content?: string | null;
      tool_calls?: DeepSeekToolCall[];
      reasoning_content?: string | null;
    };
    finish_reason: string | null;
    logprobs?: ChatLogprobsResponse | null;
  }>;
}

/**
 * Interface for prefix completion response body
 *
 * Note: This is a beta endpoint that shares parameters with chat completion,
 *
 */
// export interface ChatPrefixDeepSeekResponseBody extends ChatDeepSeekResponseBody {}
// export interface ChatPrefixDeepSeekStreamChunk extends ChatDeepSeekStreamChunk {}

/**
 * DeepSeek streaming chunk interface for FIM completions
 */
export interface DeepSeekFimStreamChunk extends BaseDeepSeekResponseBody {
  choices: Array<{
    text: string;
    index: number;
    finish_reason?: string | null;
  }>;
}

/**
 * DeepSeek models list response interface
 */
export interface DeepSeekModelsResponse {
  object: "list";
  data: Array<{
    id: string;
    object: "model";
    owned_by: string;
  }>;
}
