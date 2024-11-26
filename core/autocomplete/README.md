# Tab Autocomplete (beta)

Continue now provides support for tab autocomplete in [VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue) and [JetBrains IDEs](https://plugins.jetbrains.com/plugin/22707-continue/edit). We will be greatly improving the experience over the next few releases, and it is always helpful to hear feedback. If you have any problems or suggestions, please let us know in our [Discord](https://discord.gg/vapESyrFmJ).

## Setting up with Ollama (default)

We recommend setting up tab-autocomplete with a local Ollama instance. To do this, first download the latest version of Ollama from [here](https://ollama.ai). Then, run the following command to download our recommended model:

```bash
ollama run qwen2.5-coder:1.5b
```

Once it has been downloaded, you should begin to see completions in VS Code.

## Setting up with LM Studio

You can also set up tab-autocomplete with a local LM Studio instance by following these steps:

1. Download the latest version of LM Studio from [here](https://lmstudio.ai/)
2. Download a model (e.g. search for `Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF` and choose one of the options there)
3. Go to the server section (button is on the left), select your model from the dropdown at the top, and click "Start Server"
4. Go to the "My Models" section (button is on the left), find your selected model, and copy the name the path (example: `Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf`); this will be used as the "model" attribute in Continue
5. Go to Continue and modify the configurations for a [custom model](#setting-up-a-custom-model)
6. Set the "provider" to `lmstudio` and the "model" to the path copied earlier

Example:

```json title="config.json"
{
  "tabAutocompleteModel": {
      "title": "Qwen2.5-Coder 1.5b",
      "model": "Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF",
      "provider": "lmstudio",
  },
  ...
}
```

## Setting up a custom model

All of the configuration options available for chat models are available to use for tab-autocomplete. For example, if you wanted to use a remote vLLM instance you would edit your `config.json` like this (note that it is not inside the models array), filling in the correct model name and vLLM endpoint:

```json title="config.json"
{
    "tabAutocompleteModel": {
        "title": "Tab Autocomplete Model",
        "provider": "openai",
        "model": "<MODEL_NAME>",
        "apiBase": "<VLLM_ENDPOINT_URL>"
    },
    ...
}
```

As another example, say you want to use a different model, `deepseek-coder:6.7b-base`, with Ollama:

```json title="config.json"
{
    "tabAutocompleteModel": {
        "title": "Tab Autocomplete Model",
        "provider": "ollama",
        "model": "deepseek-coder:6.7b-base"
    },
    ...
}
```

If you aren't yet familiar with the available options, you can learn more in our [overview](../setup/overview.md).

### What model should I use?

If you are running the model locally, we recommend `qwen2.5-coder:1.5b`.

If you have a bit more compute, or are running a model in the cloud, you can upgrade to `qwen2.5-coder:7b`.

Regardless of what you are willing to spend, we do not recommend using GPT or Claude for autocomplete. Learn why [below](#i-want-better-completions-should-i-use-gpt-4).

## Configuration Options

The following can be configured in `config.json`:

### `tabAutocompleteModel`

This is just another object like the ones in the `"models"` array of `config.json`. You can choose and configure any model you would like, but we strongly suggest using a small model made for tab-autocomplete, such as `deepseek-1b`, `qwen2.5-coder:1.5b`, or `starcoder-3b`.

### `tabAutocompleteOptions`

This object allows you to customize the behavior of tab-autocomplete. The available options are:

- `useFileSuffix`: Determines whether to use the file suffix in the prompt. (Boolean)
- `maxPromptTokens`: The maximum number of prompt tokens to use. A smaller number will yield faster completions, but less context. (Number)
- `debounceDelay`: The delay in milliseconds before triggering autocomplete after a keystroke. (Number)
- `maxSuffixPercentage`: The maximum percentage of the prompt that can be dedicated to the suffix. (Number)
- `prefixPercentage`: The percentage of the input that should be dedicated to the prefix. (Number)
- `template`: An optional template string to be used for autocomplete. It will be rendered with the Mustache templating language, and is passed the 'prefix' and 'suffix' variables. (String)
- `multilineCompletions`: Whether to enable multiline completions ("always", "never", or "auto"). Defaults to "auto".

### Full example

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Tab Autocomplete Model",
    "provider": "ollama",
    "model": "qwen2.5-coder:1.5b",
    "apiBase": "https://<my endpoint>"
  },
  "tabAutocompleteOptions": {
    "maxPromptTokens": 400,
    "prefixPercentage": 0.5
  }
}
```

## Troubleshooting

### I want better completions, should I use GPT-4?

Perhaps surprisingly, the answer is no. The models that we suggest for autocomplete are trained with a highly specific prompt format, which allows them to respond to requests for completing code (see examples of these prompts [here](https://github.com/continuedev/continue/blob/main/core/autocomplete/templates.ts)). Some of the best commercial models like GPT-4 or Claude are not trained with this prompt format, which means that they won't generate useful completions. Luckily, a huge model is not required for great autocomplete. Most of the state-of-the-art autocomplete models are no more than 10b parameters, and increasing beyond this does not significantly improve performance.

### I'm not seeing any completions

Follow these steps to ensure that everything is set up correctly:

1. Make sure you have the "Enable Tab Autocomplete" setting checked (in VS Code, you can toggle by clicking the "Continue" button in the status bar).
2. Make sure you have downloaded Ollama.
3. Run `ollama run qwen2.5-coder:1.5b` to verify that the model is downloaded.
4. Make sure that any other completion providers are disabled (e.g. Copilot), as they may interfere.
5. Make sure that you aren't also using another Ollama model for chat. This will cause Ollama to constantly load and unload the models from memory, resulting in slow responses (or none at all) for both.
6. Check the output of the logs to find any potential errors (cmd/ctrl+shift+p -> "Toggle Developer Tools" -> "Console" tab in VS Code, ~/.continue/logs/core.log in JetBrains).
7. If you are still having issues, please let us know in our [Discord](https://discord.gg/vapESyrFmJ) and we'll help as soon as possible.

### Completions are slow

Depending on your hardware, you may want to try a smaller, faster model. If 3b isn't working for you we recommend trying `deepseek-coder:1.3b-base`.

### Completions don't know about my code

We are working on this! Right now Continue uses the Language Server Protocol to add definitions to the prompt, as well as using similarity search over recently edited files. We will be improving the accuracy of this system greatly over the next few weeks.

### Completions contain formatting errors

If you're seeing a common pattern of mistake that might be helpful to report, please share in Discord. We will do our best to fix it as soon as possible.

## How to turn off autocomplete

### VS Code

Click the "Continue" button in the status panel at the bottom right of the screen. The checkmark will become a "cancel" symbol and you will no longer see completions. You can click again to turn it back on.

Alternatively, open VS Code settings, search for "Continue" and uncheck the box for "Enable Tab Autocomplete".

### JetBrains

Open Settings -> Tools -> Continue and uncheck the box for "Enable Tab Autocomplete".

### Feedback

If you're turning off autocomplete, we'd love to hear how we can improve! Please let us know in our [Discord](https://discord.gg/vapESyrFmJ) or file an issue on GitHub.
