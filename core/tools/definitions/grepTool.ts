import { Tool } from "../..";

import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const grepTool: Tool = {
  type: "function",
  displayTitle: "LS Tool",
  wouldLikeTo: "list files and folders in {{{ dirPath }}}",
  isCurrently: "listing files and folders in {{{ dirPath }}}",
  hasAlready: "listed files and folders in {{{ dirPath }}}",
  readonly: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.GrepTool,
    description: "List files and folders in a given directory",
    parameters: {
      type: "object",
      required: ["dirPath", "recursive"],
      properties: {
        dirPath: {
          type: "string",
          description:
            "The directory path relative to the root of the project. Always use forward slash paths like '/'. rather than e.g. '.'",
        },
        recursive: {
          type: "boolean",
          description:
            "If true, lists files and folders recursively. To prevent unexpected large results, use this sparingly",
        },
      },
    },
  },
};

// export const exactSearchTool: Tool = {
//   type: "function",
//   displayTitle: "Exact Search",
//   wouldLikeTo: 'search for "{{{ query }}}" in the repository',
//   isCurrently: 'getting search results for "{{{ query }}}"',
//   hasAlready: 'retreived search results for "{{{ query }}}"',
//   readonly: true,
//   group: BUILT_IN_GROUP_NAME,
//   function: {
//     name: BuiltInToolNames.ExactSearch,
//     description: "Perform an exact search over the repository using ripgrep.",
//     parameters: {
//       type: "object",
//       required: ["query"],
//       properties: {
//         query: {
//           type: "string",
//           description:
//             "The search query to use. Must be a valid ripgrep regex expression, escaped where needed",
//         },
//       },
//     },
//   },
// };
