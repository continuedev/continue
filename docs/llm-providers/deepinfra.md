# DeepInfra

[DeepInfra](https://deepinfra.com) provides inference for open-source models at very low cost. To get started with DeepInfra, obtain your API key [here](https://deepinfra.com/dash). Then, find the model you want to use [here](https://deepinfra.com/models?type=text-generation) and copy the name of the model. Continue can then be configured to use the `DeepInfra` LLM class, like the example here:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "provider": "deepinfra",
      "title": "DeepInfra",
      "model": "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "apiKey": "<API_KEY>"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/DeepInfra.ts)
