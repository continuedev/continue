# LLM Context Length

Continue by default knows the context length for common models. For example, it will automatically assume 200k tokens for Claude 3. For Ollama, the context length is determined automatically by asking Ollama. If neither of these are sufficient, you can manually specify the context length by using the `"contextLength"` property in your model in config.json.

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "My Custom Model",
      "provider": "openai",
      "model": "my-model",
      "contextLength": 8192,
      "apiBase": "http://localhost:8000/v1"
    }
  ]
}
```
