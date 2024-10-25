# Flowise

[Flowise](https://flowiseai.com/) is a low-code/no-code drag & drop tool with the aim to make it easy for people to visualize and build LLM apps. Continue can then be configured to use the `Flowise` LLM class, like the example here:

```json title="config.json"
{
  "models": [
    {
      "provider": "flowise",
      "title": "Flowise",
      "model": "<MODEL>",
      "apiBase": "<API_BASE>"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/Flowise.ts)
