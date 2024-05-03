# Flowise

[Flowise](https://flowiseai.com/) is a low-code/no-code drag & drop tool with the aim to make it easy for people to visualize and build LLM apps. Continue can then be configured to use the `Flowise` LLM class, like the example here:

[Flowise](https://flowiseai.com/) 是一个低代码/无代码拖拽工具，致力于让人们简单地可视构建 LLM app 。 Continue 然后可以配置使用 `Flowise` LLM 类，比如这里的例子：

```json title="~/.continue/config.json"
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

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/Flowise.ts)
