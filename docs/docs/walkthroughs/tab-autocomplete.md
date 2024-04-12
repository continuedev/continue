# Tab Autocomplete (beta)

Continue now provides support for tab autocomplete in [VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue) and [JetBrains IDEs](https://plugins.jetbrains.com/plugin/22707-continue/edit). We will be greatly improving the experience over the next few releases, and it is always helpful to hear feedback. If you have any problems or suggestions, please let us know in our [Discord](https://discord.gg/vapESyrFmJ).

## Setting up with Starcoder 7b (recommended)

If you want to have the best autocomplete experience, we recommend using Starcoder 7b, which is available through [Fireworks AI](https://fireworks.ai/models/fireworks/starcoder-7b). To do this, obtain an API key and add it to your `config.json`:

```json
{
  "tabAutocompleteModel": {
    "title": "Starcoder 7b",
    "provider": "openai",
    "model": "accounts/fireworks/models/starcoder-7b",
    "apiBase": "https://api.fireworks.ai/inference/v1",
    "apiKey": "YOUR_API_KEY"
  }
}
```

## Setting up with Ollama (default)

We recommend setting up tab-autocomplete with a local Ollama instance. To do this, first download the latest version of Ollama from [here](https://ollama.ai). Then, run the following command to download our recommended model:

```bash
ollama run starcoder2:3b
```

Once it has been downloaded, you should begin to see completions in VS Code.

## Setting up a custom model

All of the configuration options available for chat models are available to use for tab-autocomplete. For example, if you wanted to use a remote Ollama instance you would edit your `config.json` like this (note that it is not inside the models array):

```json title=~/.continue/config.json
{
    "tabAutocompleteModel": {
        "title": "Tab Autocomplete Model",
        "provider": "ollama",
        "model": "starcoder2:3b",
        "apiBase": "https://<my endpoint>"
    },
    ...
}
```

If you aren't yet familiar with the available options, you can learn more in our [overview](../model-setup/overview.md).

### What model should I use?

If you are running the model locally, we recommend `starcoder2:3b`.

If you find it to be too slow, you should try `deepseek-coder:1.3b-base`.

If you have a bit more compute, or are running a model in the cloud, you can upgrade to `deepseek-coder:6.7b-base`.

Regardless of what you are willing to spend, we do not recommend using GPT or Claude for autocomplete. Learn why [below](#i-want-better-completions-should-i-use-gpt-4).

## Configuration Options

The following can be configured in `config.json`:

### `tabAutocompleteModel`

This is just another object like the ones in the `"models"` array of `config.json`. You can choose and configure any model you would like, but we strongly suggest using a small model made for tab-autocomplete, such as `deepseek-1b`, `starcoder-1b`, or `starcoder2-3b`.

### `tabAutocompleteOptions`

This object allows you to customize the behavior of tab-autocomplete. The available options are:

- `useCopyBuffer`: Determines whether the copy buffer will be considered when constructing the prompt. (Boolean)
- `useSuffix`: Determines whether to use the file suffix in the prompt. (Boolean)
- `maxPromptTokens`: The maximum number of prompt tokens to use. A smaller number will yield faster completions, but less context. (Number)
- `debounceDelay`: The delay in milliseconds before triggering autocomplete after a keystroke. (Number)
- `maxSuffixPercentage`: The maximum percentage of the prompt that can be dedicated to the suffix. (Number)
- `prefixPercentage`: The percentage of the input that should be dedicated to the prefix. (Number)
- `template`: An optional template string to be used for autocomplete. It will be rendered with the Mustache templating language, and is passed the 'prefix' and 'suffix' variables. (String)
- `multilineCompletions`: Whether to enable multiline completions ("always", "never", or "auto"). Defaults to "auto".
- `useCache`: Whether to cache and reuse completions when the prompt is the same as a previous one. May be useful to disable for testing purposes.
- `useOtherFiles`: Whether to include context from files outside of the current one. Turning this off should be expected to reduce the accuracy of completions, but might be good for testing.
- `disable`: Disable autocomplete (can also be done from IDE settings)

### Full example

```json title=~/.continue/config.json
{
  "tabAutocompleteModel": {
    "title": "Tab Autocomplete Model",
    "provider": "ollama",
    "model": "starcoder2:3b",
    "apiBase": "https://<my endpoint>"
  },
  "tabAutocompleteOptions": {
    "useCopyBuffer": false,
    "maxPromptTokens": 400,
    "prefixPercentage": 0.5
  }
}
```

## Troubleshooting

### I want better completions, should I use GPT-4?

Perhaps surprisingly, the answer is no. The models that we suggest for autocomplete are trained with a highly specific prompt format, which allows them to respond to requests for completing code (see examples of these prompts [here](https://github.com/continuedev/continue/blob/d2bc6359e8ebf647892ec953e418042dc7f8a685/core/autocomplete/templates.ts)). Some of the best commercial models like GPT-4 or Claude are not trained with this prompt format, which means that they won't generate useful completions. Luckily, a huge model is not required for great autocomplete. Most of the state-of-the-art autocomplete models are no more than 10b parameters, and increasing beyond this does not significantly improve performance.

### I'm not seeing any completions

Follow these steps to ensure that everything is set up correctly:

1. Make sure you have the "Enable Tab Autocomplete" setting checked (in VS Code, you can toggle by clicking the "Continue" button in the status bar).
2. Make sure you have downloaded Ollama.
3. Run `ollama run starcoder2:3b` to verify that the model is downloaded.
4. Make sure that any other completion providers are disabled (e.g. Copilot), as they may interfere.
5. Make sure that you aren't also using another Ollama model for chat. This will cause Ollama to constantly load and unload the models from memory, resulting in slow responses (or none at all) for both.
6. Check the output of the logs to find any potential errors (cmd/ctrl+shift+p -> "Toggle Developer Tools" -> "Console" tab in VS Code, ~/.continue/core.log in JetBrains).
7. If you are still having issues, please let us know in our [Discord](https://discord.gg/vapESyrFmJ) and we'll help as soon as possible.

### Completions are slow

Depending on your hardware, you may want to try a smaller, faster model. If 3b isn't working for you we recommend trying `deepseek-coder:1.3b-base`.

### Completions don't know about my code

We are working on this! Right now Continue uses the Language Server Protocol to add definitions to the prompt, as well as using similarity search over recently edited files. We will be improving the accuracy of this system greatly over the next few weeks.

### Completions contain formatting errors

If you're seeing a common pattern of mistake that might be helpful to report, please share in Discord. We will do our best to fix it as soon as possible.

### Completions are only ever single-line

To ensure that you receive multi-line completions, you can set `"multilineCompletions": "always"` in `tabAutocompleteOptions`. By default, it is `"auto"`. If you still find that you are only seeing single-line completions, this may be because some models tend to produce shorter completions when starting in the middle of a file. You can try temporarily moving text below your cursor out of your active file, or switching to a larger model.

## How to turn off autocomplete

### VS Code

Click the "Continue" button in the status panel at the bottom right of the screen. The checkmark will become a "cancel" symbol and you will no longer see completions. You can click again to turn it back on.

Alternatively, open VS Code settings, search for "Continue" and uncheck the box for "Enable Tab Autocomplete".

### JetBrains

Open Settings -> Tools -> Continue and uncheck the box for "Enable Tab Autocomplete".

### Feedback

If you're turning off autocomplete, we'd love to hear how we can improve! Please let us know in our [Discord](https://discord.gg/vapESyrFmJ) or file an issue on GitHub.
