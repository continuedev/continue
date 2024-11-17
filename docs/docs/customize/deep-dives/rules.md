---
description: Learn how to customize the system prompt with a `.continuerules` file
keywords: [rules, .continuerules, system, prompt, message]
---

# `.continuerules`

You can create a project-specific system message by adding a `.continuerules` file to the root of your project. This file is raw text and its contents will be inserted into the system message for all LLM requests.

## Simple Examples

- If you want concise answers:

```title=.continuerules
Please provide concise answers. Do explain obvious concepts. You can assume that I am knowledgable about most programming topics.
```

- If you want to ensure certain practices are followed, for example in React:

```title=.continuerules
Whenever you are writing React code, make sure to
- use functional components instead of class components
- use hooks for state management
- define an interface for your component props
- use Tailwind CSS for styling
- modularize components into smaller, reusable pieces
```
