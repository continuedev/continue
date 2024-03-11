# Tab Autocomplete (beta)

Continue now provides support for tab autocomplete in [the VS Code extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue) (make sure to download the pre-release). We will be greatly improving the experience over the next few releases, and it is always helpful to hear feedback. If you have any problems or suggestions, please let us know in our [Discord](https://discord.gg/vapESyrFmJ).

## Setting up with Ollama (default)

We recommend setting up tab-autocomplete with a local Ollama instance. To do this, first download the latest version of Ollama from [here](https://ollama.ai). Then, run the following command to download our recommended model:

```bash
ollama run starcoder:3b
```

Once it has been downloaded, you should begin to see completions in VS Code.

## Setting up a custom model

All of the configuration options available for chat models are available to use for tab-autocomplete. For example, if you wanted to use a remote Ollama instance you would edit your `config.json` like this:

```json title=~/.continue/config.json
{
    "tabAutocompleteModel": {
        "title": "Tab Autocomplete Model",
        "provider": "ollama",
        "model": "starcoder:3b",
        "apiBase": "https://<my endpoint>"
    },
    ...
}
```

If you aren't yet familiar with the available options, you can learn more in our [overview](../model-setup/overview.md).

## Configuration Options

The following can be configured in `config.json`:

### `tabAutocompleteModel`

This is just another object like the ones in the `"models"` array of `config.json`. You can choose and configure any model you would like, but we strongly suggest using a small model made for tab-autocomplete, such as `deepseek-1b`, `starcoder-1b`, or `starcoder-3b`.

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

### Full example

```json title=~/.continue/config.json
{
  "tabAutocompleteModel": {
    "title": "Tab Autocomplete Model",
    "provider": "ollama",
    "model": "starcoder:3b",
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

### I'm not seeing any completions

Follow these steps to ensure that everything is set up correctly:

1. Make sure you have the pre-release version of the extension installed.
2. Make sure you have the "Enable Tab Autocomplete" setting checked (can toggle by clicking the "Continue" button in the status bar).
3. Make sure you have downloaded Ollama.
4. Run `ollama run starcoder:3b` to verify that the model is downloaded.
5. Make sure that any other completion providers are disabled (e.g. Copilot), as they may interfere.
6. Make sure that you aren't also using another Ollama model for chat. This will cause Ollama to constantly load and unload the models from memory, resulting in slow responses (or none at all) for both.
7. Check the output of the logs to find any potential errors (cmd/ctrl+shift+p -> "Toggle Developer Tools" -> "Console" tab).
8. If you are still having issues, please let us know in our [Discord](https://discord.gg/vapESyrFmJ) and we'll help as soon as possible.

### Completions are slow

Depending on your hardware, you may want to try a smaller, faster model. If 3b isn't working for you we recommend trying `deepseek-coder:1.3b-base`.

### Completions don't know about my code

We are working on this! Right now Continue uses the Language Server Protocol to add definitions to the prompt, as well as using similarity search over recently edited files. We will be improving the accuracy of this system greatly over the next few weeks.

### Completions contain formatting errors

If you're seeing a common pattern of mistake that might be helpful to report, please share in Discord. We will do our best to fix it as soon as possible.
