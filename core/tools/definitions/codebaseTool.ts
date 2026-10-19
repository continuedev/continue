```typescript
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const codebaseTool: Tool = {
  type: "function",
  displayTitle: "Codebase Search",
  wouldLike: "search the codebase for: {{{ query }}}",
  isCurrently: "searching the codebase for: {{{ query }}}",
  hasAlready: "searched the codebase for: {{{ query }}}",
  readonly: true,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,

  function: {
    name: BuiltInToolNames.CodebaseTool,
    description:
      "Semantically search the codebase using a natural language query and retrieve relevant code snippets. Use this tool to locate implementations, trace application behavior, understand dependencies, identify relevant files, and investigate existing patterns without modifying any files.",

    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description:
            "A clear, specific natural language question describing the code or behavior to find. Include relevant features, components, functions, dependencies, or expected behavior when useful. Examples: 'How is user authentication implemented?', 'Where is the database connection configured?', 'How are API errors handled?', or 'Which files implement the background job queue?'",
        },
      },
    },
  },

  defaultToolPolicy: "allowedWithPermission",

  systemMessageDescription: {
    prefix: `To search the codebase, use the ${BuiltInToolNames.CodebaseTool} tool with a clear, specific natural language query. Describe the implementation, behavior, or code context you need to find. For example:`,
    exampleArgs: [
      ["query", "How is user authentication implemented, including middleware, routes, and session handling?"],
    ],
  },
};
```
