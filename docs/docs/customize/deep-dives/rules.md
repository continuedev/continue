---
description: Learn how to customize the system prompt with a `.continuerules` file
keywords: [rules, .continuerules, system, prompt, message]
---

# Rules

Rules are used to provide instructions to **chat** models. They are inserted into the system message for all chat requests. Rules are _only_ used during Chat, they are not used for autocomplete or other roles.

## Hub `rules` blocks

Rules can be added to an Assistant on the Continue Hub. Explore available rules [here](https://hub.continue.dev/explore/rules), or [create your own](https://hub.continue.dev/new?type=block&blockType=rules) in the Hub.

## `.continuerules`

You can create a project-specific system message by adding a `.continuerules` file to the root of your project. This file is raw text and its full contents will be used as rules.

### Simple Examples

- If you want concise answers:

```title=.continuerules
Please provide concise answers. Don't explain obvious concepts. You can assume that I am knowledgable about most programming topics.
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
