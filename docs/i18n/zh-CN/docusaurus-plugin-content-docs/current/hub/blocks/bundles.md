---
title: Bundles
sidebar_label: Bundles
description: bundles 介绍
keywords: [块, bundles]
---

# Bundles

Bundles 是一般一起使用的块的集合。你可以使用它们一次添加多个构建的块到你的定制 AI 代码助手中。它们只是 [hub.continue.dev](https://hub.continue.dev) 上的一个概念，所以它们没有出现在 `config.yaml` 中。

## 使用一个 bundle

一旦你指导哪个想要使用哪个 bundle ，你需要

1. 确保正确的助手在侧边栏中
2. 点击 "Add all blocks" 。这添加单独的块到你的助手中。
3. 添加每个块需要的任何输入 (例如， secrets) 。
4. 在助手侧边栏右手边选择 "Save changes" 。

在这之后，你可以去你的 IDE 扩展，使用 "Open VS Code" 或 "Open Jetbrains" 按钮，并开始使用新的块。

## 创建一个 bundle

要创建一个 bundle ，点击页头上的 "New bundle" 。

![New bundle button](/img/hub/bundle-new-button.png)

为你的 bundle 选择一个名称， slug ，描述和可见性。

然后，使用 "Search blocks" 输入搜索块，添加它们到你的 bundle 中。

![Create bundle page](/img/hub/bundle-create-page.png)

一旦你添加你想要的所有的块到你的 bundle 中，点击 "Create Bundle" 保存它，使它可用。

## 合成一个 bundle

当前不能合成一个 bundle 。
