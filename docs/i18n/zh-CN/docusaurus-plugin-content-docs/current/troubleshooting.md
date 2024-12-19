---
title: 故障排除
description: 故障排除，在等待 beta / alpha 测试帮助时
keywords: [重新加载, 删除, 手动, 日志, 服务器, 控制台]
---

Continue VS Code 扩展现在是 beta ， JetBrains 扩展现在是 Alpha 。如果你有问题，请跟随下面的步骤。

1. [检查日志](#检查日志)
2. [尝试最新的预览版](#下载最新的预览版)
3. [下载较老的版本](#下载一个较老的版本)
4. [解析快件键问题](#快捷键无法解析)
5. [检查常见问题的 FAQ](#常见问题)

## 检查日志

解决很多问题，第一步是阅读日志找到相关的错误信息。要做这个，跟随下面的步骤：

### VS Code

#### 控制台日志

:::info
为了查看调试日志，它包含额外的信息，点击最上面是 "Default levels" 的下拉框并选择 "Verbose" 。
:::

1. `cmd+shift+p` (MacOS) / `ctrl+shift+p` (Windows)
2. 查找，然后选择 "Developer: Toggle Developer Tools"
3. 这将打开 [Chrome DevTools window](https://developer.chrome.com/docs/devtools/)
4. 选择 `Console` 标签
5. 查看控制台日志

#### LLM 提示词日志

如果你从 LLM 获得的响应看起来是不合理的，你可以

1. 打开 "Output" 面板 (终端的下一个)
2. 在下拉框中，选择 "Continue - LLM Prompts/Completions"
3. 查看发送给 LLM ，补全所接受的确切的提示词

### JetBrains

打开 `~/.continue/logs/core.log` 。最近的日志可以在文件的底部找到。

## 下载最新的预览版

### VS Code

我们不断地修复和改进 Continue ，但是最新的修改停留在 "预览" 版大概一周，让我们可以测试它们的稳定性。如果你遇到问题，你可以尝试预览版，通过去 VS Code 的 Continue 扩展页面，并选择 "切换到预览版" ，像下面显示的这样。

![Pre-Release](../../../../static/img/prerelease.png)

### JetBrains

在 JetBrains 上， "预览版" 出现在他们的抢先体验计划 (EAP) 频道。要下载最新的 EAP 版本，启用 EAP 频道：

1. 打开 JetBrains 设置 (`cmd/ctrl + ,`) 并导航到 "插件"
2. 点击顶部的齿轮图标
3. 选择 "管理插件仓库..."
4. 添加 "[https://plugins.jetbrains.com/plugins/eap/list](https://plugins.jetbrains.com/plugins/eap/list)" 到列表中
5. 你现在总是可以在市场下载最新的 EAP 版本

## 下载一个较老的版本

如果你尝试了所有东西，报告一个错误，知道一个之前的版本对你有效，并等待回复，你可以尝试下载一个扩展的比较老的版本。

对于 VS Code ，所有版本都托管在 [这里](https://open-vsx.org/extension/Continue/continue) 的 Open VSX Registry 。一旦你下载了扩展，它是一个 .vsix 文件，你可以通过 [在这里](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix) 的以下指令手动安装它。

你可以在他们的 [市场](https://plugins.jetbrains.com/plugin/22707-continue) 中找到较老版本的 JetBrains 扩展，这将允许你从磁盘上安装。

## 快捷键无法解析

如果你的快捷键无法解析，你可能有其他命令优先于 Continue 快捷键。你可以看看是否是这种情况，在你的 IDE 的配置中修改你的快捷键绑定。

- [VSCode 快捷键文档](https://code.visualstudio.com/docs/getstarted/keybindings)
- [IntelliJ 快捷键文档](https://www.jetbrains.com/help/idea/configuring-keyboard-and-mouse-shortcuts.html)

## 常见问题

### 网络问题

#### 配置证书

如果你看到 `fetch failed` 错误，并且你的网络需要自定义证书，你需要在 `config.json` 配置它们。在 `"models"` 列表的每个对象中，添加 `requestOptions.caBundlePath` ，像这样：

```json
{
  "models": [
    {
      "title": "My Model",
      ...
      "requestOptions": {
        "caBundlePath": "/path/to/cert.pem"
      }
    }
  ],
  ...
}
```

你可能也需要为多个证书设置 `requestOptions.caBundlePath` 到路径列表。

#### VS Code 代理设置

如果你使用 VS Code ，需要通过代理进行请求，你可能已经通过 VS Code 的 [Proxy Server Support](https://code.visualstudio.com/docs/setup/network#_proxy-server-support) 设置。为了检查这个是否启用，使用 `cmd/ctrl+,` 打开设置并查找 "Proxy Support" ，除非它设置为 "off" ，那么 VS Code 将会负责对代理进行请求。

#### code-server

Continue 可以在 [code-server](https://coder.com/) 中使用，但是如果你运行，日志中错误包含 "This is likely because the editor is not running in a secure context" ，请查看 [他们的关于安全暴露 code-server 的文档](https://coder.com/docs/code-server/latest/guide#expose-code-server) 。

### 我安装了 Continue ，但是没有看到侧边栏窗口

默认情况下， VS Code 中的 Continue 窗口在左边，但是它也可以拖动到右边，这在我们的入门教程中是推荐的。在你已经安装 Continue 并将它移动到右边的情况下，它可能仍然在那里。你可以显示 Continue ，通过使用 `cmd/ctrl+L` 或点击 VS Code 右上方的按钮打开右侧边栏。

### 我得到一个 OpenAI 的 404 错误

如果你输入一个有效的 API key 和模型，但是仍然得到 OpenAI 的 404 错误，这可能是因为你需要添加信用卡到你的账单账户。你可以在 [账单控制台](https://platform.openai.com/settings/organization/billing/overview)这样做。如果你只想要检查这确实是错误的原因，你可以尝试添加 1 美元到你的账户，再检查错误是否仍然存在。

### 索引问题

如果你有持续的索引问题，我们的推荐是重新构建你的索引。注意，对于大的代码库，这可能需要一些时间。

这可以通过以下命令实现： `Continue: Rebuild codebase index` 。

### Android Studio - "Nothing to show" 在聊天中

这可以修复，通过选择 `Actions > Choose Boot runtime for the IDE` ，然后选择最新的版本，然后重启 Android Studio 。[查看这个线索](https://github.com/continuedev/continue/issues/2280#issuecomment-2365231567) 获得详情。

## 仍然有问题？

你还可以 [在这里](https://discord.gg/vapESyrFmJ) 加入我们的 Discord 社区，获得更多的支持和讨论。另外，你可以 [在这里](https://github.com/continuedev/continue/issues/new?assignees=&labels=bug&projects=&template=bug-report-%F0%9F%90%9B.md&title=) 创建一个 GitHub issue ，提供你的问题的详情，我们将能更快的帮助你。
