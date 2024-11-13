---
title: 如何设置 Codestral
description: 如何设置 Codestral
keywords: [codestral, mistral, 模型设置]
---

![mistral x continue](../../../../../../static/img/mistral-x-continue.png)

**这是一个分步指南，关于如何在 Continue 设置 Codestral ，使用 Mistral AI API ：**

1. 安装 Continue VS Code 或 JetBrains 扩展，跟随 [这里](../../getting-started/install.md) 的指令

2. 点击 Continue 窗口右下角的齿轮图标，打开 `~/.continue/config.json` (MacOS) / `%userprofile%\.continue\config.json` (Windows)

3. 登录并创建一个 API key ，在 [这里](https://console.mistral.ai/codestral) 的 Mistral AI's La Plateforme 。确保你从 "Codestral" 页面获得一个 API key ，一般的 "api.mistral.ai" API 的 API key 不能工作。

4. 为了使用 Codestral 作为你的 `自动补全` 和 `聊天` 模型，使用 Mistral API key 替换下面的 `[API_KEY]` ，并把它添加到你的 `config.json` 文件：

```json title="config.json"
{
  "models": [
    {
      "title": "Codestral",
      "provider": "mistral",
      "model": "codestral-latest",
      "apiKey": "[API_KEY]"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest",
    "apiKey": "[API_KEY]"
  }
}
```

5. 如果你遇到任何 issue 或有任何问题，请加入我们的 Discord 并在 [这里的](https://discord.gg/EfJEfdFnDQ) `#help` 频道发帖

## 故障排除

### JetBrains 的临时变通方法

Mistral AI 最近修改 API 端点，使用 `codestral.mistral.ai` 替换 `api.mistral.ai` ，我们更新的 JetBrains 扩展正在等待商店批准。在这个期间，你必须在 config.json 中指定 apiBase 为 `https://codestral.mistral.ai/v1` ，像这样：

```json title="config.json"
{
  "models": [
    {
      "title": "Codestral",
      "provider": "mistral",
      "model": "codestral-latest",
      "apiKey": "[API_KEY]",
      "apiBase": "https://codestral.mistral.ai/v1/"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Codestral",
    "provider": "mistral",
    "model": "codestral-latest",
    "apiKey": "[API_KEY]",
    "apiBase": "https://codestral.mistral.ai/v1/"
  }
}
```

### 在 Discord 寻求帮助

请加入我们的 Discord ，并在 [这里](https://discord.gg/EfJEfdFnDQ) 的 `#help` 频道发帖，如果你使用 Codestral 有任何问题
