# DeepInfra

[DeepInfra](https://deepinfra.com) provides inference for open-source models at very low cost. To get started with DeepInfra, obtain your API key [here](https://deepinfra.com/dash). Then, find the model you want to use [here](https://deepinfra.com/models?type=text-generation) and copy the name of the model. Continue can then be configured to use the `DeepInfra` LLM class, like the example here:

[DeepInfra](https://deepinfra.com) 使用很低的消耗对开源模型提供推断。为了开始使用 DeepInfra ，获取你的 API key [这里](https://deepinfra.com/dash) 。然后，找到你想要使用的模型 [这里](https://deepinfra.com/models?type=text-generation) ，复制模型的名称。 Continue 然后可以配置使用 `DeepInfra` LLM 类，比如这里的例子：

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

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/DeepInfra.ts)
