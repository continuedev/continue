const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_ARGS = {
  max_tokens: DEFAULT_MAX_TOKENS,
  temperature: 0.5,
};

const CONTEXT_LENGTH_FOR_MODEL: { [name: string]: number } = {
  "gpt-3.5-turbo": 4096,
  "gpt-3.5-turbo-0613": 4096,
  "gpt-3.5-turbo-16k": 16_384,
  "gpt-4": 8192,
  "gpt-35-turbo-16k": 16_384,
  "gpt-35-turbo-0613": 4096,
  "gpt-35-turbo": 4096,
  "gpt-4-32k": 32_768,
  "gpt-4-1106-preview": 128_000,
};

const TOKEN_BUFFER_FOR_SAFETY = 350;

export {
  DEFAULT_MAX_TOKENS,
  DEFAULT_ARGS,
  CONTEXT_LENGTH_FOR_MODEL,
  TOKEN_BUFFER_FOR_SAFETY,
};
