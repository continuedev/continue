---
title: How to set up Codestral
description: How to set up Codestral
keywords: [codestral, mistral, model setup]
---

![mistral x continue](../../../static/img/mistral-x-continue.png)

**Here is a step-by-step guide on how to set up Codestral with Continue using the Mistral AI API:**

1. Install the Continue VS Code or JetBrains extension following the instructions [here](../../getting-started/install.md)

2. Click on the gear icon in the bottom right corner of the Continue window to open `~/.continue/config.json` (MacOS) / `%userprofile%\.continue\config.json` (Windows)

3. Log in and create an API key on Mistral AI's La Plateforme [here](https://console.mistral.ai/codestral). Make sure you get an API key from the "Codestral" page.

4. To use Codestral as your model for both `autocomplete` and `chat`, replace `[API_KEY]` with your Mistral API key below and add it to your `config.json` file:

```json title="config.json"
{
  "models": [
    {
      "title": "Codestral",
      "provider": "mistral",
      "model": "codestral-latest",
      "apiKey": "[API_KEY]",
      "apiBase": "https://codestral.mistral.ai/v1"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest",
    "apiKey": "[API_KEY]",
    "apiBase": "https://codestral.mistral.ai/v1"
  }
}
```

5. If you run into any issues or have any questions, please join our Discord and post in the `#help` channel [here](https://discord.gg/EfJEfdFnDQ)

### Ask for help on Discord

Please join our Discord and post in the `#help` channel [here](https://discord.gg/EfJEfdFnDQ) if you are having problems using Codestral
