import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const shadowGetChatHistoryTool: Tool = {
  type: "function",
  displayTitle: "Get Chat History",
  wouldLikeTo: "retrieve chat history",
  isCurrently: "retrieving chat history",
  hasAlready: "retrieved chat history",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ShadowGetChatHistory,
    description:
      "Retrieve the most recent messages from this conversation. Use this when the user refers to something said earlier, asks follow-up questions, or you need context from previous turns.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description:
            "Maximum number of recent messages to retrieve (default: 20)",
        },
      },
      required: [],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};

export const shadowSearchMessagesTool: Tool = {
  type: "function",
  displayTitle: "Search Messages",
  wouldLikeTo: "search chat history",
  isCurrently: "searching chat history",
  hasAlready: "searched chat history",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ShadowSearchMessages,
    description:
      "Search this conversation for messages containing specific keywords or phrases. Use when looking for a particular topic, code snippet, or piece of information mentioned earlier.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The keyword or phrase to search for",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of matching messages to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};

export const shadowSemanticSearchTool: Tool = {
  type: "function",
  displayTitle: "Semantic Search",
  wouldLikeTo: "semantically search chat history",
  isCurrently: "searching chat history",
  hasAlready: "searched chat history",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ShadowSemanticSearch,
    description:
      "Full-text ranked search of this conversation using BM25 scoring. Finds messages by meaning and relevance, not just exact keyword matches. Prefer this over shadow_search_messages when looking for conceptually related content.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query — describe what you are looking for",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};

export const shadowGetConversationStatsTool: Tool = {
  type: "function",
  displayTitle: "Get Conversation Stats",
  wouldLikeTo: "get conversation statistics",
  isCurrently: "retrieving conversation statistics",
  hasAlready: "retrieved conversation statistics",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ShadowGetConversationStats,
    description:
      "Get statistics about this conversation: total messages, number of turns, and how many input tokens have been saved so far by Ultra Token Saving mode.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};

export const shadowGetToolResultTool: Tool = {
  type: "function",
  displayTitle: "Get Tool Result",
  wouldLikeTo: "retrieve a cached tool result",
  isCurrently: "retrieving cached tool result",
  hasAlready: "retrieved cached tool result",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ShadowGetToolResult,
    description:
      "Retrieve a cached result from a previously executed tool call in this conversation. Use this to avoid re-running expensive tool calls (file reads, searches, API calls) when their result is still valid.",
    parameters: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          description:
            "Name of the tool whose result you want to retrieve (e.g. 'read_file', 'run_terminal_command')",
        },
        max_age_turns: {
          type: "number",
          description: "How many conversation turns back to look (default: 5)",
        },
      },
      required: ["tool_name"],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};

export const shadowSearchAllSessionsTool: Tool = {
  type: "function",
  displayTitle: "Search All Sessions",
  wouldLikeTo: "search all past chat sessions",
  isCurrently: "searching all past sessions",
  hasAlready: "searched all past sessions",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ShadowSearchAllSessions,
    description:
      "Search across all past conversations (not just this one) for messages matching a keyword or phrase. Use when the user refers to something discussed in a previous chat session.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The keyword or phrase to search for",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};

export const shadowSemanticSearchAllSessionsTool: Tool = {
  type: "function",
  displayTitle: "Semantic Search All Sessions",
  wouldLikeTo: "semantically search all past sessions",
  isCurrently: "searching all past sessions",
  hasAlready: "searched all past sessions",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ShadowSemanticSearchAllSessions,
    description:
      "Full-text ranked search across all past conversations using BM25 scoring. Use when the user refers to something discussed in a previous session and a keyword search may not be precise enough.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query — describe what you are looking for",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};

export const shadowChatHistoryTools: Tool[] = [
  shadowGetChatHistoryTool,
  shadowSearchMessagesTool,
  shadowSemanticSearchTool,
  shadowGetConversationStatsTool,
  shadowGetToolResultTool,
  shadowSearchAllSessionsTool,
  shadowSemanticSearchAllSessionsTool,
];
