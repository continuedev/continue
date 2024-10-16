export const ProviderModelMap = {
  openai: [
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-0125",
    "gpt-4",
    "gpt-4-0613",
    "gpt-4-1106-preview",
    "gpt-4-turbo",
    "gpt-4-turbo-preview",
    "gpt-4-turbo-2024-04-09",
    "gpt-4o-2024-05-13",
    "gpt-4o-2024-08-06",
    "gpt-4o",
    "gpt-4o-mini-2024-07-18",
    "gpt-4o-mini",
    "gpt-4-0125-preview",
    "o1-preview",
    "o1-preview-2024-09-12",
    "o1-mini",
    "o1-mini-2024-09-12"
  ],
  anthropic: [
    "claude-2.1",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-5-sonnet-20240620",
    "claude-3-haiku-20240307"
  ],
  google: [
    "gemini-pro",
    "gemini-1.0-pro-latest",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro-exp-0801",
    "gemini-1.5-flash-latest"
  ],
  mistral: [
    "mistral-large-latest",
    "mistral-large-2407",
    "mistral-large-2402",
    "mistral-medium-latest",
    "mistral-small-latest",
    "codestral-latest",
    "open-mistral-7b",
    "open-mixtral-8x7b",
    "open-mixtral-8x22b"
  ],
  perplexity: [
    "llama-3.1-sonar-large-128k-online"
  ],
  together: [
    "Mistral-7B-Instruct-v0.2",
    "Mixtral-8x7B-Instruct-v0.1",
    "Mixtral-8x22B-Instruct-v0.1",
    "Llama-3-70b-chat-hf",
    "Llama-3-8b-chat-hf",
    "Qwen2-72B-Instruct",
    "Meta-Llama-3.1-8B-Instruct-Turbo",
    "Meta-Llama-3.1-70B-Instruct-Turbo",
    "Meta-Llama-3.1-405B-Instruct-Turbo"
  ]
} as const;
