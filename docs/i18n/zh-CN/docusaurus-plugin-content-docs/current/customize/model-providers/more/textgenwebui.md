# TextGenWebUI

TextGenWebUI 是一个综合的，开源语言模型 UI 和本地服务器。你可以使用 OpenAI-兼容服务器插件设置它，然后在你的 `config.json` 配置它，像这样：

```json title="config.json"
{
  "models": [
    {
      "title": "Text Generation WebUI",
      "provider": "text-gen-webui",
      "apiBase": "http://localhost:5000",
      "model": "MODEL_NAME"
    }
  ]
}
```
