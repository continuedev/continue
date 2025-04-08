const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_CONTEXT_LENGTH = 8192;
const DEFAULT_TEMPERATURE = 0.5;

const DEFAULT_ARGS = {
  maxTokens: DEFAULT_MAX_TOKENS,
  temperature: DEFAULT_TEMPERATURE,
};

const GPT_4_CTX_LEN = 128_000;

const CONTEXT_LENGTH_FOR_MODEL: { [name: string]: number } = {
  "gpt-3.5-turbo": 4096,
  "gpt-3.5-turbo-0613": 4096,
  "gpt-3.5-turbo-16k": 16_384,
  "gpt-35-turbo-16k": 16_384,
  "gpt-35-turbo-0613": 4096,
  "gpt-35-turbo": 4096,
  "gpt-4": 4096,
  "gpt-4-32k": 32_000,
  "gpt-4-turbo-preview": 32_000,
  "gpt-4o": GPT_4_CTX_LEN,
  "gpt-4o-mini": GPT_4_CTX_LEN,
  "gpt-4-vision": GPT_4_CTX_LEN,
  "gpt-4-0125-preview": GPT_4_CTX_LEN,
  "gpt-4-1106-preview": GPT_4_CTX_LEN,
};

const TOKEN_BUFFER_FOR_SAFETY = 350;
const PROXY_URL = "http://localhost:65433";

const DEFAULT_MAX_CHUNK_SIZE = 500; // 512 - buffer for safety (in case of differing tokenizers)
const DEFAULT_MAX_BATCH_SIZE = 64;

export {
  CONTEXT_LENGTH_FOR_MODEL,
  DEFAULT_ARGS,
  DEFAULT_CONTEXT_LENGTH,
  DEFAULT_MAX_BATCH_SIZE,
  DEFAULT_MAX_CHUNK_SIZE,
  DEFAULT_MAX_TOKENS,
  PROXY_URL,
  TOKEN_BUFFER_FOR_SAFETY,
};
