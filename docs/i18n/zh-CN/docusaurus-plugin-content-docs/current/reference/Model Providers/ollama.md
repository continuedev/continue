# Ollama

[Ollama](https://ollama.ai/) 是一个 Mac 和 Linux 的应用，简单地在本地运行开源模型，包括 Llama-2 。从网站上下载 app ，它会让你在几分钟内设置。你也可以查看更多，在他们的 [README](https://github.com/jmorganca/ollama) 。 Continue 然后可以配置使用 `Ollama` LLM 类：

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama2-7b",
      "completionOptions": {}
    }
  ]
}
```

## 补全选项

除了模型类型，你也可以配置一些 Ollama 用来来运行模型的参数。

- temperature: 可选。 temperature - 这是一个参数控制生成文本的随机性。更高的值导致更有创造性，但是可能更少的合理输出，更低的值导致更可预测和目标明确的输出。
- top_p: 可选。 topP - 这设置一个阈值（在 0 和 1 之间），来控制预测 token 的多样性。模型生成 token ，根据他们的概率分布，但是也会考虑 top-k 最多可能性 token 。
- top_k: 可选。 topK - 这个参数限制唯一 token 的数量，考虑在序列中生成下一个 token 。更高的值增加生成序列的多样性，而更低的值导致更明确的输出。
- num_predict: 可选。maxTokens - 这个决定对于给定输入提示词生成 token （字或字符）的最大数量。
- num_thread: 可选。numThreads - 这是多线程配置选项，控制模型使用多少线程来并行运行。更高的值导致更快的生成时间，但是也会增加内存使用和复杂性。设置这个为 1 或 2 ，低于你的 CPU 可以处理的线程数，为你的 GUI 留出一些，当本地运行模型时。

## 认证

如果你需要发送自定义头来认证，你可以使用 `requestOptions.headers` 属性，像这样:


```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama2-7b",
      "requestOptions": {
        "headers": {
          "Authorization": "Bearer xxx"
        }
      }
    }
  ]
}
```

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Ollama.ts)
