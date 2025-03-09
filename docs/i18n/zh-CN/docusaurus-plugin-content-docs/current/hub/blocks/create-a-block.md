---
title: 创建一个块
sidebar_label: 创建一个块
description: 创建块指南
keywords: [块, 创建, 使用]
---

# 创建一个块

## 合成一个块

你应该合成一个块，如果你想要在一些修改后使用它。

通过点击 "remix" 按钮，你会去到 "Create a remix" 页面。

![Remix block button](/img/hub/block-remix-button.png)

到了这里，你可以 1) 编辑 YAML 块的配置 2) 修改名称、描述、图标等。点击 "Create block" 将使这个块可以在助手中使用。

## 从零开始创建一个块

为了从零开始创建一个块，你需要在上边栏点击 "New block" 。

![New block button](/img/hub/block-new-button.png)

在填写块的信息之后，你想要创建一个块，跟随 `config.yaml` [reference documentation](../../yaml-reference.md) 。查看 [hub.continue.dev](https://hub.continue.dev/explore/models) 上块的示例，访问 [YAML 参考](../../yaml-reference.md#完整的-yaml-配置示例) 文档获取更多详情。

![New block page](/img/hub/block-new-page.png)

### 块输入

块可以接收值，包括保密值，通过模板作为输入。对于用户使用块需要设置的值，你可以使用模板变量 (例如 `${{ inputs.API_KEY}}`) 。然后，用户可以设置 `API_KEY: ${{ secrets.MY_API_KEY }}` 在他们的助手 `with` 子句中。
