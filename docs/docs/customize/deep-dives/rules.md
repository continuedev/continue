---
description: Rules are used to provide instructions to the model for Chat, Edit, and Agent requests.
keywords: [rules, .continuerules, system, prompt, message]
---

# Rules

Rules are used to provide instructions to the model for [Chat](../../chat/how-to-use-it.md), [Edit](../../edit/how-to-use-it.md), and [Agent](../../agent/how-to-use-it.md) requests.

Rules are not included in most other requests, such as [autocomplete](./autocomplete.mdx) or [apply](../model-roles/apply.mdx).

You can view the current rules by clicking the pen icon above the main toolbar:

![rules input toolbar section](/img/notch-rules.png)

To form the system message, rules are joined with new lines, in the order they appear in the toolbar. This includes the base chat system message ([see below](#chat-system-message)).

## `rules` blocks

Rules can be added to an Assistant on the Continue Hub. Explore available rules [here](https://hub.continue.dev/explore/rules), or [create your own](https://hub.continue.dev/new?type=block&blockType=rules) in the Hub. These blocks are defined using the [`config.yaml` syntax](../../reference.md#rules) and can also be created locally.

:::info Automatically create local rule blocks
When in Agent mode, you can simply prompt the agent to create a rule for you using the `builtin_create_rule_block` tool if enabled.

For example, you can say "Create a rule for this", and a rule will be created for you in `.continue/rules` based on your conversation.
:::

### Syntax

Rules blocks can be simple text, written in YAML configuration files, or as Markdown (`.md`) files. They can have the following properties:

- `name` (**required**): A display name/title for the rule
- `rule` (**required**): The text content of the rule
- `globs` (optional): When files are provided as context that match this glob pattern, the rule will be included. This can be either a single pattern (e.g., `"**/*.{ts,tsx}"`) or an array of patterns (e.g., `["src/**/*.ts", "tests/**/*.ts"]`).

```yaml title="config.yaml"
rules:
  - Always annotate Python functions with their parameter and return types

  - name: TypeScript best practices
    rule: Always use TypeScript interfaces to define shape of objects. Use type aliases sparingly.
    globs: "**/*.{ts,tsx}"

  - name: TypeScript test patterns
    rule: In TypeScript tests, use Jest's describe/it pattern and follow best practices for mocking.
    globs:
      - "src/**/*.test.ts"
      - "tests/**/*.ts"

  - uses: myprofile/my-mood-setter
    with:
      TONE: concise
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
