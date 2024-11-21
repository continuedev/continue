# Msty

[Msty](https://msty.app/) 是一个 Windows, Mac 和 Linux 的应用，让运行本地开源模型上线很容易，包括 Llama-2, DeepSeek Coder 等。不需要使用你的终端，运行命令或任何东西。只需要从网站下载应用，点击按钮，就会启动和运行。然后， Continue 可以配置使用 `Msty` LLM 类：

```json title="config.json"
{
  "models": [
    {
      "title": "Msty",
      "provider": "msty",
      "model": "deepseek-coder:6.7b",
      "completionOptions": {}
    }
  ]
}
```

## 完成选项

除了模型类型，你还可以配置一些 Msty 运行模型的参数。

- temperature: options.temperature - 这是一个控制生成文本的随机性的参数。较高的值导致更有创造性，但是可能更少的有条理的输入，而更低的值导致更可预测和目标明确的输出。
- top_p: options.topP - 这个设置一个阈值 (在 0 和 1 之前) ，用来控制预测 token 的多样性。模型生成 token ，通过它们的概率分布，但是也考虑 top-k 最可能的 token 。
- top_k: options.topK - 这个参数限制唯一 token 的数量，当考虑生成序列的下一个 token 时。较高的值增加生成序列的多样性，而较低的值导致更明确的输出。
- num_predict: options.maxTokens - 这个决定生成 token 的最大数量 (字或字符) ，对于给定的输入提示词。
- num_thread: options.numThreads - 这是多线程配置选项，控制模型并发使用多少个线程。更到的值导致更快的生成时间，但是也会增加内存使用和复杂性。在本地运行模型时，设置这个为 1 或 2 ，低于你的 CPU 可以处理的线程数量，留给你的 GUI 一些。

## 认证

如果你需要发送自定义头来认证，你可以使用 `requestOptions.headers` 属性，像这样：

```json title="config.json"
{
  "models": [
    {
      "title": "Msty",
      "provider": "msty",
      "model": "deepseek-coder:6.7b",
      "requestOptions": {
        "headers": {
          "Authorization": "Bearer xxx"
        }
      }
    }
  ]
}
```

[查看代码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Msty.ts)
