# IBM

To setup IBM, add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "IBM",
      "provider": "ibm",
      "model": "granite-34b-code-instruct",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

Visit the [IBM dashboard](https://bam.res.ibm.com/) to create an API key.

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/IBM.ts)
