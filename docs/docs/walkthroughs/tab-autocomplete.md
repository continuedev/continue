# Tab Autocomplete (Experimental)

Continue now provides experimental support for tab autocomplete in VS Code. You can enable it by downloading the pre-release version of the extension, opening VS Code settings, and then checking the box that says "Enable Tab Autocomplete". There is also a button on the bottom/status bar for fast access. We will be greatly improving the experience over the next few releases, and it is always helpful to hear feedback. If you have any problems or suggestions, please let us know in our [Discord](https://discord.gg/vapESyrFmJ).

## Setting up with Ollama

We recommend setting up tab-autocomplete with a local Ollama instance. To do this, first download the latest version of Ollama from [here](https://ollama.ai). Then, run the following command to download our recommended model:

```bash
ollama run deepseek-coder:1.3b-base
```

Once it has been downloaded, you should begin to see completions in VS Code.

## Configuration Options

The following can be configured in `config.json`:

### `tabAutocompleteModel`

This is just another object like the ones in the `"models"` array of `config.json`. You can choose and configure any model you would like, but we strongly suggest using a small model made for tab-autocomplete, such as `deepseek-1b`, `starcoder-1b`, or `starcoder-3b`.

### `tabAutocompleteOptions`

Empty for now. Let use know what you'd like access to!

## Troubleshooting

### I'm not seeing any completions

Follow these steps to ensure that everything is set up correctly:

1. Make sure you have the pre-release version of the extension installed.
2. Make sure you have the "Enable Tab Autocomplete" setting checked.
3. Make sure you have downloaded Ollama.
4. Run `ollama run deepseek-coder:1.3b-base` to verify that the model is downloaded.
5. Make sure that any other completion providers are disabled (e.g. Copilot), as they may interfere.
6. Check the output of the logs to find any potential errors (cmd/ctrl+shift+p -> "Toggle Developer Tools" -> "Console" tab).
7. If you are still having issues, please let us know in our [Discord](https://discord.gg/vapESyrFmJ) and we'll help as soon as possible.

### Completions are slow

We are working on this! You can expect improvements in the time frame of the next few days. For now, you will probably see faster completions in smaller files where there isn't as much context above the cursor.

### Completions don't know about my code

We are working on this as well! Right now Continue only sees your current file surrounding the cursor. We're already partway through building a full-text search feature that will help Continue know about other files. You can expect to see improvements in the time frame of roughly a week.

### Completions contain formatting errors

If you're seeing a common pattern of mistake that might be helpful to report, please share in Discord. We will do our best to fix it as soon as possible.
