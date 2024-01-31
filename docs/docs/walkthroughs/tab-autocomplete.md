# Tab Autocomplete (Experimental)

Continue now provides experimental support for tab autocomplete in VS Code. You can enable it by downloading the pre-release version of the extension, opening VS Code settings, and then checking the box that says "Enable Tab Autocomplete". There is also a button on the bottom/status bar for fast access. We will be greatly improving the experience over the next few releases, and it is always helpful to hear feedback. If you have any problems or suggestions, please let us know in our [Discord](https://discord.gg/vapESyrFmJ).

# Setting up with Ollama

We recommend setting up tab-autocomplete with a local Ollama instance. To do this, first download the latest version of Ollama from [here](https://ollama.ai). Then, run the following command to download the model:

```bash
ollama run deepseek-coder:1.3b-base
```

Once it has been downloaded, you should begin to see completions in VS Code.

# Configuration Options

The following can be configured in `config.json`:

### `tabAutocompleteModel`

This is just another object like the ones in the `"models"` array of `config.json`. You can choose and configure any model you would like, but we strongly suggest using a small model made for tab-autocomplete, such as `deepseek-1b`, `starcoder-1b`, or `starcoder-3b`.

### `tabAutocompleteOptions`

Empty for now.
