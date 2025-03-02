---
description: 了解如何使用 `.continuerules` 文件定制系统提示词
keywords: [rules, .continuerules, 系统, 提示词, 消息]
---

# rules

rules 用来提供指令给 **聊天** 模型。它们插入到所有聊天请求的系统消息中。 rules _只在_ 聊天中使用，它们没有在自动补全或其他角色中使用。

## hub `rules` 块

rules 可以在 Continue Hub 的助手中添加。在 Hub 中查看可用的 rules [在这里](https://hub.continue.dev/explore/rules), 或者 [创建你自己的](https://hub.continue.dev/new?type=block&block=rules) 。

## `.continuerules`

你可以创建一个项目特定的系统消息，通过添加一个 `.continuerules` 文件到你的项目的根目录。这个文件是一个纯文本，它的内容将被插入到系统消息中，对于所有的聊天请求。规则不会用来自动补全。

### 简单示例

- 如果你想要简洁的答案：

```title=.continuerules
Please provide concise answers. Do explain obvious concepts. You can assume that I am knowledgable about most programming topics.
```

- 如果你想要确保某些做法被遵循，例如在 React 中：

```title=.continuerules
Whenever you are writing React code, make sure to
- use functional components instead of class components
- use hooks for state management
- define an interface for your component props
- use Tailwind CSS for styling
- modularize components into smaller, reusable pieces
```
