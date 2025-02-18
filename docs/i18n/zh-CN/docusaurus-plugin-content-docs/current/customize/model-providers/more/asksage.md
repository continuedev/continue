# Ask Sage

:::info

为了获取 Ask Sage API key ，登录 Ask Sage 平台（如果你没有帐号，可以在 [这里](https://chat.asksage.ai/) 创建一个）跟随 Ask Sage 文档： [Ask Sage API Key](https://docs.asksage.ai/docs/api-documentation/api-documentation.html) 中的指令

:::

## 配置

为了使用 Ask Sage 模型，以下配置是必需的，在 `config.json` 文件中：

```json
{
  "models": [
    {
      "apiKey": "YOUR_API_KEY", 
      "apiBase": "https://api.asksage.ai/server/", // apiBase will be the same for all models, but will vary based on tenant. 
      "model": "gpt4-gov",
      "title": "GPT-4 gov",
      "provider": "askSage"
    }
  ]
}
```

`apiBase` 在 Ask Sage 平台列出，当你生成 `API key` 时。你会看到上下文，如下所示：

> Server API for query/training etc.:
> - Documentation: https://app.swaggerhub.com/apis-docs/NICOLASCHAILLAN_1/server_ask-sage_api/1.0
> - URL for this API is: https://api.asksage.ai/server/

## 使用

当前， Ask Sage 提供的模型设置支持以下两个功能，由 Continue.Dev 提供：

- `聊天` 在侧边栏中理解和迭代代码
- `编辑` 修改代码，而不需要离开当前文件

更多模型，功能和文档将会在将来添加，对于 Ask Sage 集成。

> 我们推荐使用`OpenAI` 或 `Anthropic` 模型获得最好的性能和结果，对于 `聊天` 和 `编辑` 功能。

## Ask Sage 文档

Ask Sage 文档不在 Continue.Dev 上，所以如果你有任何 Ask Sage 的问题或需要帮助，在聊天中输入 `@ask` 并选择 `Ask Sage` 选项。然后继续询问你的关于 Ask Sage 的问题。

## 当前 Ask Sage 支持的模型

当前 Ask Sage 支持的模型有：

| Index | Model                  | Added | Status |
|-------|------------------------|-------|--------|
| 1     | GPT-4 Gov              |  Yes  | ✅     |
| 2     | GPT-4o Gov             |  Yes  | ✅     |
| 3     | GPT-4o-mini Gov        |  Yes  | ✅     |
| 4     | GPT-3.5-Turbo Gov      |  Yes  | ✅     |
| 5     | GPT-4o                 |  Yes  | ✅     |
| 6     | GPT-4o-mini            |  Yes  | ✅     |
| 7     | GPT-4                  |  Yes  | ✅     |
| 8     | GPT-4-32K              |  Yes  | ✅     |
| 9     | GPT-o1                 |  Yes  | ✅     |
| 10    | GPT-o1-mini            |  Yes  | ✅     |
| 11    | GPT-3.5-turbo          |  Yes  | ✅     |
| 12    | Calude 3.5 Sonnet Gov  |  Yes  | ✅     |
| 13    | Calude 3 Opus          |  Yes  | ✅     |
| 14    | Calude 3 Sonet         |  Yes  | ✅     |
| 15    | Calude 3.5 Sonnet      |  Yes  | ✅     |
| 16    | Grok (xAI)             |  Yes  | ✅     |
| 17    | Groq Llama 3.3         |  Yes  | ✅     |
| 18    | Groq 70B               |  Yes  | ✅     |
| 19    | Gemini Pro             |  Yes  | ✅     |
| 20    | llama 3                |  Yes  | ✅     |
| 21    | Mistral Large          |  Yes  | ✅     |
