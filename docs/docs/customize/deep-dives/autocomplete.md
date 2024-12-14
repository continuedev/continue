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
ollama run qwen2.5-coder:1.5b
```

Once it has been downloaded, you should begin to see completions in VS Code.

### Setting up a custom model

All of the configuration options available for chat models are available to use for tab-autocomplete. For example, if you wanted to use a remote Ollama instance you would edit your `config.json` like this (note that it is not inside the models array):

```json title="config.json"
{
    "tabAutocompleteModel": {
        "title": "Tab Autocomplete Model",
        "provider": "ollama",
        "model": "qwen2.5-coder:1.5b",
        "apiBase": "https://<my endpoint>"
    },
    ...
}
```

If you aren't yet familiar with the available options, you can find the full reference [here](./configuration.md).

## Configuration Options

The following can be configured in `config.json`:

### `tabAutocompleteModel`

This is just another object like the ones in the `"models"` array of `config.json`. You can choose and configure any model you would like, but we strongly suggest using a small model made for tab-autocomplete, such as `deepseek-1b`, `qwen2.5-coder:1.5b`, or `starcoder2-3b`.

### `tabAutocompleteOptions`

This object allows you to customize the behavior of tab-autocomplete. The available options are shown below, and you can find their default values [here](https://github.com/continuedev/continue/blob/fbeb2e4fe15d4b434a30a136f74b672485c852d9/core/util/parameters.ts).

- `disable`: Disable autocomplete (can also be done from IDE settings)
- `maxPromptTokens`: The maximum number of prompt tokens to use. A smaller number will yield faster completions, but less context. (Number)
- `debounceDelay`: The delay in milliseconds before triggering autocomplete after a keystroke. (Number)
- `maxSuffixPercentage`: The maximum percentage of the prompt that can be dedicated to the suffix. (Number)
- `prefixPercentage`: The percentage of the input that should be dedicated to the prefix. (Number)
- `transform`: Whether LLM output should be transformed to correct common model pitfalls.
- `template`: An optional template string to be used for autocomplete. It will be rendered with the Mustache templating language, and is passed the 'prefix' and 'suffix' variables. (String)
- `multilineCompletions`: Whether to enable multiline completions ("always", "never", or "auto"). Defaults to "auto".
- `useCache`: Whether to cache and reuse completions when the prompt is the same as a previous one. May be useful to disable for testing purposes.
- `onlyMyCode`: If set to true, Continue will not include any snippets from go to definition unless they are within your repository
- `useRecentlyEdited`: If set to true, Continue will use recently edited files when generating completions.
- `disableInFiles`: A list of glob patterns for files in which you want to disable tab autocomplete.
- `logDisableInFiles`: If set to true, Continue will log when it disables autocomplete in a file due to `disableInFiles` patterns
- `useImports`: If set to true, Continue will use imports from the current file when generating completions.
- `showWhateverWeHaveAtXMs`: Truncate the response of the LLM after X milliseconds, even if it's not finished. This can be useful to speed up completions, but may result in incomplete results.
- `logCompletionCache`: If set to true, Continue will logs the cache hits for completions
- `logSnippetLimiting`: If set to true, Continue will log when it limits the number of snippets used in a completion due to the `maxPromptTokens`
- `logSnippetTimeouts`: If set to true, Continue will log when it times out while fetching snippets
- `logOutlineCreation`: If set to true, Continue will log how it creates an outline for a snippet
- `logCompletionStop`: If set to true, Continue will log why it stops using the response from the LLM as completion
- `logDroppedLinesFilter`: If set to true, Continue will log how it drops lines from the LLM result
- `logPostprocessing`: If set to true, Continue will log how it postprocesses completion after the whole completion has been collected
- `logCompletionOutcome`: If set to true, Continue will log the final completion which is sent to the editor
- `logRootPathSnippets`: If set to true, Continue will log how it finds snippets by looking at the syntactical context of the completion location
- `logImportSnippets`: If set to true, Continue will log how it finds snippets by looking at the imports of the file at the completion location
- `logDiffSnippets`: If set to true, Continue will log the snippets it finds in the source control (GIT) diff
- `logClipboardSnippets`: If set to true, Continue will log the snippets it finds in the clipboard
- `defaultLanguageOptions`: Default language options for all languages
- `languageOptions`: Override of language options per language. Will be combined with the default language options

The following options are supported for both `defaultLanguageOptions` and `languageOptions`:

- `enableRootPathSnippets`: Enable root path snippets. If enabled, the syntactical context of the autocomplete location will be searched for type references
- `enableImportSnippets`: Enable import snippets. If enabled, imports of the file will be searched for snippets
- `enableDiffSnippets`: Enable diff snippets. If enabled, the diffs from the source control system (GIT) will be used as context for the LLM
- `enableClipboardSnippets`: Enable clipboard snippets. If enabled, the clipboard will be used as context for the LLM
- `outlineNodeReplacements`: When creating outlines for autocompletion context, replace the nodes in this map with the given replacement string
- `filterMaxRepeatingLines`: Stop the completion when a line is repeated more than this many time. Set to -1 to disable

## FAQs

### I want better completions, should I use GPT-4?

No, you should not. GPT-4 is not a good model for tab-autocomplete. It is too slow and too expensive. Instead, we recommend using a small model made for tab-autocomplete, such as `deep

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
    "debounceDelay": 500,
    "maxPromptTokens": 1500,
    "disableInFiles": ["*.md"]
  }
}
```

## FAQs

### I want better completions, should I use GPT-4?

Perhaps surprisingly, the answer is no. The models that we suggest for autocomplete are trained with a highly specific prompt format, which allows them to respond to requests for completing code (see examples of these prompts [here](https://github.com/continuedev/continue/blob/main/core/autocomplete/templates.ts)). Some of the best commercial models like GPT-4 or Claude are not trained with this prompt format, which means that they won't generate useful completions. Luckily, a huge model is not required for great autocomplete. Most of the state-of-the-art autocomplete models are no more than 10b parameters, and increasing beyond this does not significantly improve performance.

### I'm not seeing any completions

Follow these steps to ensure that everything is set up correctly:

1. Make sure you have the "Enable Tab Autocomplete" setting checked (in VS Code, you can toggle by clicking the "Continue" button in the status bar, and in JetBrains by going to Settings -> Tools -> Continue).
2. Make sure you have downloaded Ollama.
3. Run `ollama run qwen2.5-coder:1.5b` to verify that the model is downloaded.
4. Make sure that any other completion providers are disabled (e.g. Copilot), as they may interfere.
5. Check the output of the logs to find any potential errors: <kbd>cmd/ctrl</kbd> + <kbd>shift</kbd> + <kbd>P</kbd> -> "Toggle Developer Tools" -> "Console" tab in VS Code, ~/.continue/logs/core.log in JetBrains.
6. Check VS Code settings to make sure that `"editor.inlineSuggest.enabled"` is set to `true` (use <kbd>cmd/ctrl</kbd> + <kbd>,</kbd> then search for this and check the box)
7. If you are still having issues, please let us know in our [Discord](https://discord.gg/vapESyrFmJ) and we'll help as soon as possible.

### Completions are only ever single-line

To ensure that you receive multi-line completions, you can set `"multilineCompletions": "always"` in `tabAutocompleteOptions`. By default, it is `"auto"`. If you still find that you are only seeing single-line completions, this may be because some models tend to produce shorter completions when starting in the middle of a file. You can try temporarily moving text below your cursor out of your active file, or switching to a larger model.

### Can I configure a "trigger key" for autocomplete?

Yes, in VS Code, if you don't want to be shown suggestions automatically you can:

1. Set `"editor.inlineSuggest.enabled": false` in VS Code settings to disable automatic suggestions
2. Open "Keyboard Shortcuts" (cmd/ctrl+k, cmd/ctrl+s) and search for `editor.action.inlineSuggest.trigger`
3. Click the "+" icon to add a new keybinding
4. Press the key combination you want to use to trigger suggestions (e.g. <kbd>cmd/ctrl</kbd> + <kbd>space</kbd>)
5. Now whenever you want to see a suggestion, you can press your key binding (e.g. <kbd>cmd/ctrl</kbd> + <kbd>space</kbd>) to trigger suggestions manually

### Is there a shortcut to accept one line at a time?

This is a built-in feature of VS Code, but it's just a bit hidden. See this great [StackOverflow answer](https://stackoverflow.com/questions/72228174/accept-line-by-line-from-autocompletion/78001122#78001122) for more details.

### How to turn off autocomplete

#### VS Code

Click the "Continue" button in the status panel at the bottom right of the screen. The checkmark will become a "cancel" symbol and you will no longer see completions. You can click again to turn it back on.

Alternatively, open VS Code settings, search for "Continue" and uncheck the box for "Enable Tab Autocomplete".

You can also use the default shortcut to disable autocomplete directly using a chord: press and hold <kbd>ctrl/cmd</kbd> + <kbd>K</kbd> (continue holding <kbd>ctrl/cmd</kbd>) and press <kbd>ctrl/cmd</kbd> + <kbd>A</kbd>. This will turn off autocomplete without navigating through settings.

#### JetBrains

Open Settings -> Tools -> Continue and uncheck the box for "Enable Tab Autocomplete".

#### Feedback

If you're turning off autocomplete, we'd love to hear how we can improve! Please let us know in our [Discord](https://discord.gg/vapESyrFmJ) or file an issue on GitHub.
