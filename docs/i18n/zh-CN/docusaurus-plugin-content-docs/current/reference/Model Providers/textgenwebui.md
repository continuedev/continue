# TextGenWebUI

TextGenWebUI 是一个综合的，开源的语言模型 UI 和本地服务器。你可以设置它使用一个 OpenAI 兼容的服务器插件，然后配置它在你的 `config.json` 像这样：

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Text Generation WebUI",
      "provider": "openai",
      "apiBase": "http://localhost:5000",
      "model": "MODEL_NAME"
    }
  ]
}
```
