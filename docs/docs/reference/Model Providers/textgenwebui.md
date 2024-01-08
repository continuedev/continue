# TextGenWebUI

TextGenWebUI is a comprehensive, open-source language model UI and local server. You can set it up with an OpenAI-compatible server plugin, and then configure it in your `config.json` like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Text Generation WebUI",
      "provider": "openai",
      "apiBase": "http://localhost:5000",
      "model": "MODEL_NAME"
    }
  ]
}
```
