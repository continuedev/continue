# Msty

[Msty](https://msty.app/) is an application for Windows, Mac, and Linux that makes it really easy to run online as well as local open-source models, including Llama-2, DeepSeek Coder, etc. No need to fidget with your terminal, run a command, or anything. Just download the app from the website, click a button, and you are up and running. Continue can then be configured to use the `Msty` LLM class:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Msty",
      "provider": "msty",
      "model": "deepseek-coder:6.7b",
      "completionOptions": {}
    }
  ]
}
```

## Completion Options

In addition to the model type, you can also configure some of the parameters that Msty uses to run the model.

- temperature: options.temperature - This is a parameter that controls the randomness of the generated text. Higher values result in more creative but potentially less coherent outputs, while lower values lead to more predictable and focused outputs.
- top_p: options.topP - This sets a threshold (between 0 and 1) to control how diverse the predicted tokens should be. The model generates tokens that are likely according to their probability distribution, but also considers the top-k most probable tokens.
- top_k: options.topK - This parameter limits the number of unique tokens to consider when generating the next token in the sequence. Higher values increase the variety of generated sequences, while lower values lead to more focused outputs.
- num_predict: options.maxTokens - This determines the maximum number of tokens (words or characters) to generate for the given input prompt.
- num_thread: options.numThreads - This is the multi-threading configuration option that controls how many threads the model uses for parallel processing. Higher values may lead to faster generation times but could also increase memory usage and complexity. Set this to one or two lower than the number of threads your CPU can handle to leave some for your GUI when running the model locally.

## Authentication

If you need to send custom headers for authentication, you may use the `requestOptions.headers` property like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Msty",
      "provider": "msty",
      "model": "deepseek-coder:6.7b",
      "requestOptions": {
        "headers": {
          "Authorization": "Bearer xxx"
        }
      }
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Msty.ts)
