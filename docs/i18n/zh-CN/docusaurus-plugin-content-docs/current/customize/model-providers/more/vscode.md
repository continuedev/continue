# VSCode CoPilot

通过 GitHub CoPilot 扩展的 VSCode LLM。需要安装 [GitHub CoPilot 扩展](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) 并登录。

## 模型

你对高级模型的访问权限可能会有所不同，特别是对于 `o1` 级别的模型。

最后更新时间：2025年1月28日：

- `copilot/gpt-3.5-turbo`
- `copilot/gpt-4`
- `copilot/gpt-4o`
- `copilot/gpt-4o-mini`
- `copilot/o1-mini`
- `copilot/o1-ga`
- `copilot/claude-3.5-sonnet` (需要[选择加入](https://github.com/settings/copilot))

1. 安装 [GitHub CoPilot 扩展](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)。
2. 登录并获取有效的订阅。
3. 更新 Continue 配置文件：

```json title="config.json"
{
  "models": [
    {
      "title": "VSCode LM",
      "provider": "vscode-lm",
      "model": "copilot/gpt-4o",
      "apiKey": "你的_API_密钥"
    }
  ]
}
```
