import { ShadowChatDb } from "../../data/shadowChatDb.js";
import { ToolImpl } from "./index.js";

const DEFAULT_HISTORY_LIMIT = 20;
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_MAX_AGE_TURNS = 5;

function requireSessionId(extras: { sessionId?: string }): string {
  if (!extras.sessionId) {
    throw new Error(
      "No session ID available for this conversation — shadow chat history tools require one.",
    );
  }
  return extras.sessionId;
}

export const shadowGetChatHistoryImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireSessionId(extras);
  const limit =
    typeof args?.limit === "number" ? args.limit : DEFAULT_HISTORY_LIMIT;
  const history = await ShadowChatDb.getHistory(sessionId, limit);
  return [
    {
      name: "Chat History",
      description: "Recent messages in this conversation",
      content: JSON.stringify(history),
    },
  ];
};

export const shadowSearchMessagesImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireSessionId(extras);
  const query = typeof args?.query === "string" ? args.query : "";
  const limit =
    typeof args?.limit === "number" ? args.limit : DEFAULT_SEARCH_LIMIT;
  const results = await ShadowChatDb.searchMessages(sessionId, query, limit);
  return [
    {
      name: "Search Results",
      description: `Messages matching "${query}"`,
      content: JSON.stringify(results),
    },
  ];
};

export const shadowSemanticSearchImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireSessionId(extras);
  const query = typeof args?.query === "string" ? args.query : "";
  const limit =
    typeof args?.limit === "number" ? args.limit : DEFAULT_SEARCH_LIMIT;
  const results = await ShadowChatDb.semanticSearch(sessionId, query, limit);
  return [
    {
      name: "Semantic Search Results",
      description: `Ranked results for "${query}"`,
      content: JSON.stringify(results),
    },
  ];
};

export const shadowGetConversationStatsImpl: ToolImpl = async (
  _args,
  extras,
) => {
  const sessionId = requireSessionId(extras);
  const stats = await ShadowChatDb.getConversationStats(sessionId);
  const savingsPercent =
    stats.totalEstimatedBaselineTokens > 0
      ? Math.round(
          (stats.totalTokensSaved / stats.totalEstimatedBaselineTokens) * 100,
        )
      : 0;
  return [
    {
      name: "Conversation Stats",
      description: "Token usage and savings for this conversation",
      content: JSON.stringify({ ...stats, savingsPercent }),
    },
  ];
};

export const shadowGetToolResultImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireSessionId(extras);
  const toolName = typeof args?.tool_name === "string" ? args.tool_name : "";
  const maxAgeTurns =
    typeof args?.max_age_turns === "number"
      ? args.max_age_turns
      : DEFAULT_MAX_AGE_TURNS;
  const cached = await ShadowChatDb.getToolResult(
    sessionId,
    toolName,
    maxAgeTurns,
  );
  return [
    {
      name: "Cached Tool Result",
      description:
        cached === undefined
          ? `No cached result for '${toolName}'`
          : `Cached result for '${toolName}'`,
      content:
        cached === undefined
          ? JSON.stringify({
              found: false,
              message: `No cached result found for tool '${toolName}' within the last ${maxAgeTurns} turns.`,
            })
          : JSON.stringify({
              found: true,
              input: cached.inputArgs,
              result: cached.result,
            }),
    },
  ];
};

export const shadowSearchAllSessionsImpl: ToolImpl = async (args) => {
  const query = typeof args?.query === "string" ? args.query : "";
  const limit =
    typeof args?.limit === "number" ? args.limit : DEFAULT_SEARCH_LIMIT;
  const results = await ShadowChatDb.searchAllSessions(query, limit);
  return [
    {
      name: "Cross-Session Search Results",
      description: `Messages matching "${query}" across all sessions`,
      content: JSON.stringify(results),
    },
  ];
};

export const shadowSemanticSearchAllSessionsImpl: ToolImpl = async (args) => {
  const query = typeof args?.query === "string" ? args.query : "";
  const limit =
    typeof args?.limit === "number" ? args.limit : DEFAULT_SEARCH_LIMIT;
  const results = await ShadowChatDb.semanticSearchAllSessions(query, limit);
  return [
    {
      name: "Cross-Session Semantic Search Results",
      description: `Ranked results for "${query}" across all sessions`,
      content: JSON.stringify(results),
    },
  ];
};
