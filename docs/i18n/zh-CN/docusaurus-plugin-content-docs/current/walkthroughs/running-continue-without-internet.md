---
title: 没有互联网的情况下使用 Continue
description: 如何在没有互联网的情况下使用 Continue
keywords: [没有互联网, 物理隔离, 本地模型]
---

# 没有互联网的情况下使用 Continue

Continue 甚至可以在物理隔离的计算机上运行，如果你使用的本地模型。只需要少量调整就可以工作。

1. 从 [Open VSX Registry](https://open-vsx.org/extension/Continue/continue) 下载最新的 .vsix 文件， [安装到 VS Code](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix) 。
2. 打开 `~/.continue/config.json` 并设置 `"allowAnonymousTelemetry": false` 。这将会停止 Continue 尝试请求 PostHog 。
3. 同样在 `config.json` 中，设置默认的模型为本地的模型。你可以看到可用的选项 [这里](../model-setup/select-model.md) 。
4. 重启 VS Code ，确保修改 `config.json` 生效。
