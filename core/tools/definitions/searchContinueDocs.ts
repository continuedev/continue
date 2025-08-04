import { Tool } from "../..";
import { getConfigYamlPath } from "../../util/paths";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { createSystemMessageExampleCall } from "../systemMessageTools/buildToolsSystemMessage";

export const searchContinueDocsTool: Tool = {
  type: "function",
  displayTitle: "Search Continue Docs",
  wouldLikeTo: 'search the Continue documentation for "{{{ query }}}"',
  isCurrently: 'searching the Continue documentation for "{{{ query }}}"',
  hasAlready: 'searched the Continue documentation for "{{{ query }}}"',
  readonly: true,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.SearchContinueDocs,
    description: `Search across the Continue documentation to find relevant information and context for a given query. Returns detailed content from matching documentation pages. If you have questions about config.yaml, tell the user that they can view and edit the file at this location: ${getConfigYamlPath()}. However, you CAN NOT read or write to this file.`,
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant documentation",
        },
      },
    },
  },
  systemMessageDescription: createSystemMessageExampleCall(
    BuiltInToolNames.SearchContinueDocs,
    `To search the Continue documentation for information about a specific topic, use the ${BuiltInToolNames.SearchContinueDocs} tool`,
    [["query", "how to set up autocomplete"]],
  ),
};
