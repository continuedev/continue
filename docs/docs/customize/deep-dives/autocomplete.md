---
title: Autocomplete
keywords: [autocomplete]
---

### Setting up with Codestral (recommended)

If you want to have the best autocomplete experience, we recommend using Codestral, which is available through the [Mistral API](https://console.mistral.ai/). To do this, obtain an API key and add it to your `config.json`:

```json
{
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest",
    "apiKey": "YOUR_API_KEY"
  }
}
```

### Setting up with Ollama (default)

If you'd like to run your autocomplete model locally, we recommend using Ollama. To do this, first download the latest version of Ollama from [here](https://ollama.ai). Then, run the following command to download our recommended model:

```bash
ollama run starcoder2:3b
```

Once it has been downloaded, you should begin to see completions in VS Code.

### Setting up a custom model

All of the configuration options available for chat models are available to use for tab-autocomplete. For example, if you wanted to use a remote Ollama instance you would edit your `config.json` like this (note that it is not inside the models array):

```json title="config.json"
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

If you aren't yet familiar with the available options, you can find the full reference [here](../config.mdx).

## Configuration Options

The following can be configured in `config.json`:

### `tabAutocompleteModel`

This is just another object like the ones in the `"models"` array of `config.json`. You can choose and configure any model you would like, but we strongly suggest using a small model made for tab-autocomplete, such as `deepseek-1b`, `starcoder-1b`, or `starcoder2-3b`.

### `tabAutocompleteOptions`

This object allows you to customize the behavior of tab-autocomplete. The available options are shown below, and you can find their default values [here](https://github.com/continuedev/continue/blob/fbeb2e4fe15d4b434a30a136f74b672485c852d9/core/util/parameters.ts).

- `disable`: Disable autocomplete (can also be done from IDE settings)
- `template`: An optional template string to be used for autocomplete. It will be rendered with the Mustache templating language, and is passed the 'prefix' and 'suffix' variables. (String)
- `useCopyBuffer`: Determines whether the copy buffer will be considered when constructing the prompt. (Boolean)
- `useFileSuffix`: Determines whether to use the file suffix in the prompt. (Boolean)
- `maxPromptTokens`: The maximum number of prompt tokens to use. A smaller number will yield faster completions, but less context. (Number)
- `prefixPercentage`: The percentage of the input that should be dedicated to the prefix. (Number)
- `maxSuffixPercentage`: The maximum percentage of the prompt that can be dedicated to the suffix. (Number)
- `debounceDelay`: The delay in milliseconds before triggering autocomplete after a keystroke. (Number)
- `multilineCompletions`: Whether to enable multiline completions ("always", "never", or "auto"). Defaults to "auto".
- `useCache`: Whether to cache and reuse completions when the prompt is the same as a previous one. May be useful to disable for testing purposes.
- `useOtherFiles`: Whether to include context from files outside of the current one. Turning this off should be expected to reduce the accuracy of completions, but might be good for testing.
- `disableInFiles`: A list of glob patterns for files in which you want to disable tab autocomplete.

### Full example

```json title="config.json"
{
  "tabAutocompleteModel": {
    "title": "Tab Autocomplete Model",
    "provider": "ollama",
    "model": "starcoder2:3b",
    "apiBase": "https://<my endpoint>"
  },
  "tabAutocompleteOptions": {
    "debounceDelay": 500,
    "maxPromptTokens": 1500,
    "disableInFiles": ["*.md"]
  }
}
```

## FAQs

### I want better completions, should I use GPT-4?

Perhaps surprisingly, the answer is no. The models that we suggest for autocomplete are trained with a highly specific prompt format, which allows them to respond to requests for completing code (see examples of these prompts [here](https://github.com/continuedev/continue/blob/d2bc6359e8ebf647892ec953e418042dc7f8a685/core/autocomplete/templates.ts)). Some of the best commercial models like GPT-4 or Claude are not trained with this prompt format, which means that they won't generate useful completions. Luckily, a huge model is not required for great autocomplete. Most of the state-of-the-art autocomplete models are no more than 10b parameters, and increasing beyond this does not significantly improve performance.

### I'm not seeing any completions

Follow these steps to ensure that everything is set up correctly:

1. Make sure you have the "Enable Tab Autocomplete" setting checked (in VS Code, you can toggle by clicking the "Continue" button in the status bar, and in JetBrains by going to Settings -> Tools -> Continue).
2. Make sure you have downloaded Ollama.
3. Run `ollama run starcoder2:3b` to verify that the model is downloaded.
4. Make sure that any other completion providers are disabled (e.g. Copilot), as they may interfere.
5. Check the output of the logs to find any potential errors (cmd/ctrl+shift+p -> "Toggle Developer Tools" -> "Console" tab in VS Code, ~/.continue/logs/core.log in JetBrains).
6. Check VS Code settings to make sure that `"editor.inlineSuggest.enabled"` is set to `true` (use cmd/ctrl+, then search for this and check the box)
7. If you are still having issues, please let us know in our [Discord](https://discord.gg/vapESyrFmJ) and we'll help as soon as possible.

### Completions are slow

Depending on your hardware, you may want to try a smaller, faster model. If 3b isn't working for you we recommend trying `deepseek-coder:1.3b-base`.

### Completions are only ever single-line

To ensure that you receive multi-line completions, you can set `"multilineCompletions": "always"` in `tabAutocompleteOptions`. By default, it is `"auto"`. If you still find that you are only seeing single-line completions, this may be because some models tend to produce shorter completions when starting in the middle of a file. You can try temporarily moving text below your cursor out of your active file, or switching to a larger model.

### Can I configure a "trigger key" for autocomplete?

Yes, in VS Code, if you don't want to be shown suggestions automatically you can:

1. Set `"editor.inlineSuggest.enabled": false` in VS Code settings to disable automatic suggestions
2. Open "Keyboard Shortcuts" (cmd/ctrl+k, cmd/ctrl+s) and search for `editor.action.inlineSuggest.trigger`
3. Click the "+" icon to add a new keybinding
4. Press the key combination you want to use to trigger suggestions (e.g. `ctrl+space`)
5. Now whenever you want to see a suggestion, you can press your key binding (e.g. `ctrl+space`) to trigger suggestions manually

### Is there a shortcut to accept one line at a time?

This is a built-in feature of VS Code, but it's just a bit hidden. See this great [StackOverflow answer](https://stackoverflow.com/questions/72228174/accept-line-by-line-from-autocompletion/78001122#78001122) for more details.

### How to turn off autocomplete

#### VS Code

Click the "Continue" button in the status panel at the bottom right of the screen. The checkmark will become a "cancel" symbol and you will no longer see completions. You can click again to turn it back on.

Alternatively, open VS Code settings, search for "Continue" and uncheck the box for "Enable Tab Autocomplete".

You can also use the default shortcut to disable autocomplete directly: press `ctrl/cmd + K`, `ctrl/cmd + A`. This will turn off autocomplete without navigating through settings.

#### JetBrains

Open Settings -> Tools -> Continue and uncheck the box for "Enable Tab Autocomplete".

#### Feedback

If you're turning off autocomplete, we'd love to hear how we can improve! Please let us know in our [Discord](https://discord.gg/vapESyrFmJ) or file an issue on GitHub.
