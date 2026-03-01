import { Tool } from "../..";

import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const todosTool: Tool = {
  type: "function",
  displayTitle: "View or Create Todos",
  wouldLikeTo: "work with todos in the current workspace",
  isCurrently: "getting or creating todos in the current workspace",
  hasAlready: "worked with todos in the current workspace",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TodoTool,
    description:
      "Create a new plan/todo list when the user asks to 'create a plan', 'create a todo list', or 'create a task list'. Pass the complete plan as arguments with a summary, list of todos, and optional actions (files/urls needed).",
    parameters: {
      type: "object",
      required: ["summary", "todos"],
      properties: {
        summary: {
          type: "string",
          description: "Brief description of what needs to be done",
        },
        todos: {
          type: "array",
          description: "Array of todo items with text and order",
          items: {
            type: "object",
            required: ["text", "order"],
            properties: {
              text: {
                type: "string",
                description: "The todo item description",
              },
              order: {
                type: "number",
                description: "The order/position of this todo (1-based)",
              },
              id: {
                type: "number",
                description: "Optional unique identifier for this todo",
              },
              completed: {
                type: "boolean",
                description: "Whether this todo is completed (default: false)",
              },
            },
          },
        },
        actions: {
          type: "array",
          description: "Optional list of files or URLs needed for reference",
          items: {
            type: "object",
            required: ["type", "reason"],
            properties: {
              type: {
                type: "string",
                enum: ["file", "url"],
                description: "Type of action: file or url",
              },
              patterns: {
                type: "array",
                items: { type: "string" },
                description: "File glob patterns (required if type is 'file')",
              },
              url: {
                type: "string",
                description: "URL to reference (required if type is 'url')",
              },
              reason: {
                type: "string",
                description: "Why this file or URL is needed",
              },
            },
          },
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `When the user asks to create a plan, todo list, or task list, use the ${BuiltInToolNames.TodoTool} tool and pass the complete plan as structured arguments.`,
    exampleArgs: [
      [
        `{
        "summary": "Implement user authentication system",
        "todos": [
            {"text": "Create user model with email and password fields", "order": 1},
            {"text": "Implement password hashing with bcrypt", "order": 2},
            {"text": "Add login and signup routes", "order": 3},
            {"text": "Create JWT token generation and validation", "order": 4}
        ],
        "actions": [
            {"type": "file", "patterns": ["src/models/**", "src/routes/auth.ts"], "reason": "Need to modify user models and auth routes"},
            {"type": "url", "url": "https://jwt.io/introduction", "reason": "JWT token specification for proper implementation"}
        ]
    }`,
        "",
      ],
    ],
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "NumberedListIcon",
};
