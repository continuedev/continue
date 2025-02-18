---
description: 了解如何使用 `.continuerules` 文件定制系统提示词
keywords: [rules, .continuerules, 系统, 提示词, 消息]
---

# `.continuerules`

你可以创建一个项目特定的系统消息，通过添加一个 `.continuerules` 文件到你的项目的根目录。这个文件是一个纯文本，它的内容将被插入到系统消息中，对于所有的聊天请求。规则不会用来自动补全。

## 简单示例

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
