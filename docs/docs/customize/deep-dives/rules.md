---
description: Learn how to customize the system prompt with a `.continuerules` file
keywords: [rules, .continuerules, system, prompt, message]
---

# Rules

Rules are used to provide instructions to the model for [Chat](../../chat/how-to-use-it.md), [Edit](../../edit/how-to-use-it.md), and [Agent](../../agent/how-to-use-it.md) requests.

Rules are **_NOT_** included in most other requests, such as [autocomplete](./autocomplete.mdx) or [apply](../model-roles/apply.mdx).

You can view the current rules by clicking the pen icon above the main toolbar:

![rules input toolbar section](/img/notch-rules.png)

To form the system message, rules are joined with new lines, in the order they appear in the toolbar. This includes the base chat system message ([see below](#chat-system-message)).

## `rules` blocks

Rules can be added to an Assistant on the Continue Hub. Explore available rules [here](https://hub.continue.dev/explore/rules), or [create your own](https://hub.continue.dev/new?type=block&blockType=rules) in the Hub. These blocks are defined using the [`config.yaml` syntax](../../reference.md#rules) and can also be created locally.

:::info Automatically create local rule blocks
When in Agent mode, you can simply prompt the agent to create a rule for you.

For example, you can say "Create a rule for this", and a rule will be created for you in `~/.continue/rules` based on your conversation.
:::

Rules blocks can be simple text, or have the following properties:

- `name` (**required**): A display name/title for the rule
- `rule` (**required**): The text content of the rule

Examples:

```yaml title="config.yaml"
rules:
  - uses: myprofile/my-mood-setter
    with:
      TONE: consise
  - Always annotate Python functions with their parameter and return types
  - Always write Google style docstrings for functions and classes
  - name: Server-side components
    rule: When writing Next.js React components, use server-side components where possible instead of client components.
```

## Chat System Message

Continue includes a simple default system message for [Chat](../../chat/how-to-use-it.md) and [Agent](../../agent/how-to-use-it.md) requests, to help the model provide reliable codeblock formats in its output.

This can be viewed in the rules section of the toolbar (see above), or visit the source code [here](https://github.com/continuedev/continue/blob/main/core/llm/constructMessages.ts#L4)

Advanced users can override this system message for a specific model if needed by using `chatOptions.baseSystemMessage`. See the [`config.yaml` reference](../../reference.md#models).

## `.continuerules`

You can create project-specific rules by adding a `.continuerules` file to the root of your project. This file is raw text and its full contents will be used as rules.

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
