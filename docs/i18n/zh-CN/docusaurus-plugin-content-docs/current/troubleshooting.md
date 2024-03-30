---
title: ❓ 故障排除
description: 故障排除，在等待 beta / alpha 测试帮助时
keywords: [reload, delete, manually, logs, server, console]
---

# ❓ 问题解决

Continue 的 VS Code 扩展现在是 beta ， Intellij 扩展是 Alpha 。如果你有问题，请跟随下面的步骤。

## 检查终端日志（VS Code）

为了解决很多问题，首先的步骤是查看日志，查找相关的错误消息。要这么做，跟随下面的步骤：

1. `cmd+shift+p` (MacOS) / `ctrl+shift+p` (Windows)
2. 查找然后选择 "Developer: Toggle Developer Tools"
3. 这将打开 [Chrome DevTools window](https://developer.chrome.com/docs/devtools/)
4. 选择 `Console` 标签页
5. 查看终端日志

## 配置确认

如果你看到一个 `fetch failed` 错误，你的网络需要定制的认证，你需要在 `config.json` 中配置它。在 `"models"` 列表中的每个对象中，添加 `requestOptions.caBundlePath` 像这样：

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

你可能也要设置 `requestOptions.caBundlePath` 对于多个认证的 path 列表。

## 升级 VS Code 版本

Continue 构建于 Node.js 版本 19.0.0 ，可能与旧版本的 Node 不兼容。如果扩展加载完全失败，（例如，按下 ctrl/cmd+L 引起一个命令不存在的警告，而且侧边栏不加载）, 你可能需要升级 VS Code 为最新版本。

## Android Studio - JCEF Not Supported

当前版本的 Android Studio, 不像其他 JetBrains IDE ，没有默认支持 Java Chromium Embedded Framework ，这是 Continue web-based 侧边栏所需要的。如果你看到一个错误，表示 JCEF failed to initialize ，你可能能解决这个问题，通过 [修改你的启动运行时](https://github.com/continuedev/continue/issues/596#issuecomment-1789327178) 。

## 下载一个更新的版本

如果你使用一个旧版本的 Continue 插件，特别是依赖于独立 Python server 的，我们推荐下载扩展的最新版本，随着我们不断地修复 bug ，可能已经修复任何主要的 issue 。

## 下载一个更老的版本

如果你尝试了所有东西，报告一个错误，知道之前的版本对你是工作的，等待回复，你可以试着下载一个更老版本的扩展。

对于 VS Code, 所有版本都在 Open VSX Registry [这里](https://open-vsx.org/extension/Continue/continue) 。一旦你下载了扩展，它是一个 .vsix 文件，你可以手动安装它，通过下面的命令 [这里](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix) 。

你可以在他们的 [marketplace](https://plugins.jetbrains.com/plugin/22707-continue) 上找到 Jetbrains 扩展老的版本 ，允许你从磁盘上安装。

## 仍然有问题？

创建一个 Github issue [这里](https://github.com/continuedev/continue/issues/new?assignees=&labels=bug&projects=&template=bug-report-%F0%9F%90%9B.md&title=) ，留下你的问题的细节，我们将尽快帮助你解决。
