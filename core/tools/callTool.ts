import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import * as path from "path";
import { ContextItem, McpUiState, Tool, ToolCall, ToolExtras } from "..";
import { MCPManagerSingleton } from "../context/mcp/MCPManagerSingleton";
import { ContinueError, ContinueErrorReason } from "../util/errors";
import { canParseUrl } from "../util/url";
import { BuiltInToolNames } from "./builtIn";

import { codebaseToolImpl } from "./implementations/codebaseTool";
import { createNewFileImpl } from "./implementations/createNewFile";
import { createRuleBlockImpl } from "./implementations/createRuleBlock";
import { configToolImpl, statusToolImpl } from "./implementations/configStatus";
import { fetchUrlContentImpl } from "./implementations/fetchUrlContent";
import { fileGlobSearchImpl } from "./implementations/globSearch";
import { gitToolImpl } from "./implementations/git";
import { grepSearchImpl } from "./implementations/grepSearch";
import { githubToolImpl } from "./implementations/github";
import { lsToolImpl } from "./implementations/lsTool";
import {
  listMcpResourcesImpl,
  mcpAuthImpl,
  readMcpResourceImpl,
} from "./implementations/mcpTools";
import { readCurrentlyOpenFileImpl } from "./implementations/readCurrentlyOpenFile";
import { readFileImpl } from "./implementations/readFile";

import { readFileRangeImpl } from "./implementations/readFileRange";
import { readSkillImpl } from "./implementations/readSkill";
import { requestRuleImpl } from "./implementations/requestRule";
import { runTerminalCommandImpl } from "./implementations/runTerminalCommand";
import { enterWorktreeImpl } from "./implementations/enterWorktree";
import { exitWorktreeImpl } from "./implementations/exitWorktree";
import { notifyUserImpl } from "./implementations/notifyUser";
import { toolSearchImpl } from "./implementations/toolSearch";
import { searchWebImpl } from "./implementations/searchWeb";
import { skillToolImpl } from "./implementations/skill";
import { sleepToolImpl } from "./implementations/sleep";
import { subagentToolImpl } from "./implementations/subagent";
import {
  taskCreateImpl,
  taskGetImpl,
  taskListImpl,
  taskOutputImpl,
  taskStopImpl,
  taskUpdateImpl,
} from "./implementations/taskTools";
import {
  sendMessageImpl,
  teamCreateImpl,
  teamDeleteImpl,
  teamMailboxImpl,
  teamStatusImpl,
} from "./implementations/teamTools";
import { todoWriteImpl } from "./implementations/todoWrite";
import { viewDiffImpl } from "./implementations/viewDiff";
import { viewRepoMapImpl } from "./implementations/viewRepoMap";
import { viewSubdirectoryImpl } from "./implementations/viewSubdirectory";
import { coerceArgsToSchema, safeParseToolCallArgs } from "./parseArgs";

async function callHttpTool(
  url: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  const response = await extras.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      arguments: args,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to call tool at ${url}:\n${JSON.stringify(data)}`);
  }

  return data.output;
}

export function encodeMCPToolUri(mcpId: string, toolName: string): string {
  return `mcp://${encodeURIComponent(mcpId)}/${encodeURIComponent(toolName)}`;
}

export function decodeMCPToolUri(uri: string): [string, string] | null {
  const url = new URL(uri);
  if (url.protocol !== "mcp:") {
    return null;
  }
  return [
    decodeURIComponent(url.hostname),
    decodeURIComponent(url.pathname).slice(1), // to remove leading '/'
  ];
}

async function callToolFromUri(
  uri: string,
  args: any,
  extras: ToolExtras,
): Promise<{
  contextItems: ContextItem[];
  mcpUiState?: McpUiState;
}> {
  const parseable = canParseUrl(uri);
  if (!parseable) {
    throw new Error(`Invalid URI: ${uri}`);
  }
  const parsedUri = new URL(uri);

  switch (parsedUri?.protocol) {
    case "http:":
    case "https:":
      return {
        contextItems: await callHttpTool(uri, args, extras),
      };
    case "mcp:":
      const decoded = decodeMCPToolUri(uri);
      if (!decoded) {
        throw new Error(`Invalid MCP tool URI: ${uri}`);
      }
      const [mcpId, toolName] = decoded;
      const client = MCPManagerSingleton.getInstance().getConnection(mcpId);

      if (!client) {
        throw new Error("MCP connection not found");
      }
      const coercedArgs = coerceArgsToSchema(
        args,
        extras.tool?.function?.parameters,
      );
      const response = await client.client.callTool(
        {
          name: toolName,
          arguments: coercedArgs,
        },
        CallToolResultSchema,
        { timeout: client.options.timeout },
      );

      if (response.isError === true) {
        throw new Error(JSON.stringify(response.content));
      }

      let mcpUiState: McpUiState | undefined = undefined;
      const uiResourceUri =
        extras.tool?.mcpMeta?.ui?.resourceUri ||
        extras.tool?.mcpMeta?.["ui/resourceUri"];
      if (uiResourceUri) {
        try {
          const resource = await client.getResource(uiResourceUri);
          // only single content supported for UI for now
          if (resource.contents?.length) {
            for (const c of resource.contents) {
              if ("text" in c && typeof c.text === "string") {
                mcpUiState = {
                  content: c,
                };
              }
            }
          }

          if (!mcpUiState) {
            console.error(
              "Invalid MCP UI resource content",
              JSON.stringify(resource),
            );
          }
        } catch (e) {
          console.error("Error fetching MCP UI resource", e);
        }
      }

      const contextItems: ContextItem[] = [];
      (response.content as any).forEach((item: any) => {
        if (item.type === "text") {
          contextItems.push({
            name: extras.tool.displayTitle,
            description: "Tool output",
            content: item.text,
            icon: extras.tool.faviconUrl,
          });
        } else if (item.type === "resource") {
          // TODO resource change subscribers https://modelcontextprotocol.io/docs/concepts/resources
          if (item.resource?.blob) {
            contextItems.push({
              name: extras.tool.displayTitle,
              description: "MCP Item Error",
              content:
                "Error: tool call received unsupported blob resource item",
              icon: extras.tool.faviconUrl,
            });
          }
          // TODO account for mimetype? // const mimeType = item.resource.mimeType
          // const uri = item.resource.uri;
          contextItems.push({
            name: extras.tool.displayTitle,
            description: "Tool output",
            content: item.resource.text,
            icon: extras.tool.faviconUrl,
          });
        } else {
          contextItems.push({
            name: extras.tool.displayTitle,
            description: "MCP Item Error",
            content: `Error: tool call received unsupported item of type "${item.type}"`,
            icon: extras.tool.faviconUrl,
          });
        }
      });
      return { contextItems, mcpUiState };
    default:
      throw new Error(`Unsupported protocol: ${parsedUri?.protocol}`);
  }
}

export async function callBuiltInTool(
  functionName: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  switch (functionName) {
    case BuiltInToolNames.ReadFile:
      return await readFileImpl(args, extras);
    case BuiltInToolNames.ReadFileRange:
      return await readFileRangeImpl(args, extras);
    case BuiltInToolNames.CreateNewFile:
      return await createNewFileImpl(args, extras);
    case BuiltInToolNames.GrepSearch:
      return await grepSearchImpl(args, extras);
    case BuiltInToolNames.FileGlobSearch:
      return await fileGlobSearchImpl(args, extras);
    case BuiltInToolNames.RunTerminalCommand:
      return await runTerminalCommandImpl(args, extras);
    case BuiltInToolNames.SearchWeb:
      return await searchWebImpl(args, extras);
    case BuiltInToolNames.FetchUrlContent:
      return await fetchUrlContentImpl(args, extras);
    case BuiltInToolNames.Sleep:
      return await sleepToolImpl(args, extras);
    case BuiltInToolNames.Subagent:
      return await subagentToolImpl(args, extras);
    case BuiltInToolNames.ViewDiff:
      return await viewDiffImpl(args, extras);
    case BuiltInToolNames.LSTool:
      return await lsToolImpl(args, extras);
    case BuiltInToolNames.ReadCurrentlyOpenFile:
      return await readCurrentlyOpenFileImpl(args, extras);
    case BuiltInToolNames.CreateRuleBlock:
      return await createRuleBlockImpl(args, extras);
    case BuiltInToolNames.RequestRule:
      return await requestRuleImpl(args, extras);
    case BuiltInToolNames.CodebaseTool:
      return await codebaseToolImpl(args, extras);
    case BuiltInToolNames.ReadSkill:
      return await readSkillImpl(args, extras);
    case BuiltInToolNames.Skill:
      return await skillToolImpl(args, extras);
    case BuiltInToolNames.NotifyUser:
      return await notifyUserImpl(args, extras);
    case BuiltInToolNames.EnterWorktree:
      return await enterWorktreeImpl(args, extras);
    case BuiltInToolNames.ExitWorktree:
      return await exitWorktreeImpl(args, extras);
    case BuiltInToolNames.ToolSearch:
      return await toolSearchImpl(args, extras);
    case BuiltInToolNames.Git:
      return await gitToolImpl(args, extras);
    case BuiltInToolNames.GitHub:
      return await githubToolImpl(args, extras);
    case BuiltInToolNames.ListMcpResources:
      return await listMcpResourcesImpl(args, extras);
    case BuiltInToolNames.ReadMcpResource:
      return await readMcpResourceImpl(args, extras);
    case BuiltInToolNames.McpAuth:
      return await mcpAuthImpl(args, extras);
    case BuiltInToolNames.ViewRepoMap:
      return await viewRepoMapImpl(args, extras);
    case BuiltInToolNames.ViewSubdirectory:
      return await viewSubdirectoryImpl(args, extras);
    case BuiltInToolNames.TodoWrite:
      return await todoWriteImpl(args, extras);
    case BuiltInToolNames.TaskCreate:
      return await taskCreateImpl(args, extras);
    case BuiltInToolNames.TaskGet:
      return await taskGetImpl(args, extras);
    case BuiltInToolNames.TaskList:
      return await taskListImpl(args, extras);
    case BuiltInToolNames.TaskOutput:
      return await taskOutputImpl(args, extras);
    case BuiltInToolNames.TaskStop:
      return await taskStopImpl(args, extras);
    case BuiltInToolNames.TaskUpdate:
      return await taskUpdateImpl(args, extras);
    case BuiltInToolNames.TeamCreate:
      return await teamCreateImpl(args, extras);
    case BuiltInToolNames.TeamDelete:
      return await teamDeleteImpl(args, extras);
    case BuiltInToolNames.TeamStatus:
      return await teamStatusImpl(args, extras);
    case BuiltInToolNames.TeamMailbox:
      return await teamMailboxImpl(args, extras);
    case BuiltInToolNames.SendMessage:
      return await sendMessageImpl(args, extras);
    case BuiltInToolNames.Config:
      return await configToolImpl(args, extras);
    case BuiltInToolNames.Status:
      return await statusToolImpl(args, extras);
    case BuiltInToolNames.AskUserQuestion: {
      const questions: import("./definitions/askUserQuestion").AskUserQuestion[] =
        args.questions ?? [];
      if (!extras.onUserInteractionRequest) {
        // No GUI interaction available outside an agent session — inform the model
        return [
          {
            name: "Ask User Question",
            description: "Question skipped: no interactive session available",
            content:
              "Unable to ask the user questions in this context. Please make assumptions and proceed, or include the question in your response text.",
          },
        ];
      }
      // Retrieve the sessionId stored on extras by the agent runner
      const sessionId = (extras as any)._agentSessionId as string | undefined;
      const answers = await extras.onUserInteractionRequest(
        sessionId ?? "",
        questions,
      );
      const answersText = questions
        .map((q) => {
          const answer = answers[q.question] ?? "(no answer)";
          return `"${q.question}" → ${answer}`;
        })
        .join("\n");
      return [
        {
          name: "User Answers",
          description: "Answers to your questions",
          content: `User has answered your questions:\n${answersText}\n\nYou can now continue with the user's answers in mind.`,
        },
      ];
    }
    case BuiltInToolNames.LspQuery: {
      const { operation, filePath, line, character } = args as {
        operation: string;
        filePath: string;
        line?: number;
        character?: number;
      };
      const ide = extras.ide;

      // Resolve to absolute path via IDE if relative
      let resolvedPath = filePath;
      try {
        const workspaceDirs = await ide.getWorkspaceDirs();
        if (!path.isAbsolute(filePath) && workspaceDirs[0]) {
          resolvedPath = path.join(workspaceDirs[0], filePath);
        }
      } catch {
        // Best effort
      }

      // 0-based position for Continue's IDE methods
      const loc = {
        filepath: resolvedPath,
        position: {
          line: Math.max(0, (line ?? 1) - 1),
          character: Math.max(0, (character ?? 1) - 1),
        },
      };

      let result: string;
      switch (operation) {
        case "goToDefinition": {
          const defs = await ide.gotoDefinition(loc);
          result =
            defs.length === 0
              ? "No definition found."
              : defs
                  .map(
                    (d) =>
                      `${d.filepath}:${d.range.start.line + 1}:${d.range.start.character + 1}`,
                  )
                  .join("\n");
          break;
        }
        case "findReferences": {
          const refs = await ide.getReferences(loc);
          result =
            refs.length === 0
              ? "No references found."
              : refs
                  .map(
                    (r) =>
                      `${r.filepath}:${r.range.start.line + 1}:${r.range.start.character + 1}`,
                  )
                  .join("\n");
          break;
        }
        case "documentSymbols": {
          const syms = await ide.getDocumentSymbols(resolvedPath);
          result =
            syms.length === 0
              ? "No symbols found."
              : syms.map((s) => `${s.name} (${s.kind})`).join("\n");
          break;
        }
        case "getProblems": {
          const problems = await ide.getProblems(resolvedPath);
          result =
            problems.length === 0
              ? "No problems found."
              : problems
                  .map(
                    (p) =>
                      `${p.filepath}:${p.range.start.line + 1} ${p.message}`,
                  )
                  .join("\n");
          break;
        }
        default:
          result = `Unknown LSP operation: ${operation}`;
      }
      return [
        {
          name: "LSP Result",
          description: `${operation} on ${filePath}`,
          content: result,
        },
      ];
    }
    default:
      throw new Error(`Tool "${functionName}" not found`);
  }
}

// Handles calls for core/non-client tools
// Returns an error context item if the tool call fails
// Note: Edit tool is handled on client
export async function callTool(
  tool: Tool,
  toolCall: ToolCall,
  extras: ToolExtras,
): Promise<{
  contextItems: ContextItem[];
  errorMessage: string | undefined;
  errorReason?: ContinueErrorReason;
  mcpUiState?: McpUiState;
}> {
  try {
    const args = safeParseToolCallArgs(toolCall);
    const { contextItems, mcpUiState } = tool.uri
      ? await callToolFromUri(tool.uri, args, extras)
      : {
          contextItems: await callBuiltInTool(tool.function.name, args, extras),
        };
    if (tool.faviconUrl) {
      contextItems.forEach((item) => {
        item.icon = tool.faviconUrl;
      });
    }

    return {
      contextItems,
      errorMessage: undefined,
      mcpUiState,
    };
  } catch (e) {
    let errorMessage = `${e}`;
    let errorReason: ContinueErrorReason | undefined;

    if (e instanceof ContinueError) {
      errorMessage = e.message;
      errorReason = e.reason;
    } else if (e instanceof Error) {
      errorMessage = e.message;
    }

    return {
      contextItems: [],
      errorMessage,
      errorReason,
    };
  }
}

// ─── Batch execution (ported from Marcel toolOrchestration.ts) ────────────────

export type ToolCallBatchResult = {
  toolCallId: string;
  contextItems: ContextItem[];
  errorMessage?: string;
  errorReason?: ContinueErrorReason;
  mcpUiState?: McpUiState;
};

type ToolCallBatch = {
  /** When true, all calls in this batch can run concurrently (all are readonly) */
  concurrent: boolean;
  calls: ToolCall[];
};

const MAX_CONCURRENT_TOOL_CALLS = 10;

/**
 * Partition tool calls into batches.
 * Consecutive read-only tool calls are grouped into a single concurrent batch.
 * Any write tool call forms its own serial batch.
 *
 * Mirrors Marcel's partitionToolCalls logic.
 */
export function partitionToolCallBatches(
  toolCalls: ToolCall[],
  tools: Tool[],
): ToolCallBatch[] {
  return toolCalls.reduce<ToolCallBatch[]>((batches, call) => {
    const tool = tools.find((t) => t.function.name === call.function.name);
    const isReadOnly = tool?.readonly === true;

    const last = batches[batches.length - 1];
    if (isReadOnly && last?.concurrent) {
      last.calls.push(call);
    } else {
      batches.push({ concurrent: isReadOnly, calls: [call] });
    }
    return batches;
  }, []);
}

/**
 * Execute multiple tool calls, batching concurrent (read-only) calls together
 * and running write calls serially. Mirrors Marcel's runTools orchestration.
 *
 * @param toolCalls - All tool calls to execute for one LLM turn
 * @param tools - Available tool definitions
 * @param extras - Execution context (ide, llm, fetch, etc.)
 * @param abortSignal - Optional abort signal
 */
export async function callToolsBatched(
  toolCalls: ToolCall[],
  tools: Tool[],
  extras: Omit<ToolExtras, "tool" | "toolCallId">,
  abortSignal?: AbortSignal,
): Promise<ToolCallBatchResult[]> {
  const batches = partitionToolCallBatches(toolCalls, tools);
  const results: ToolCallBatchResult[] = [];

  for (const batch of batches) {
    if (abortSignal?.aborted) break;

    if (batch.concurrent) {
      // Execute read-only calls concurrently in chunks of MAX_CONCURRENT_TOOL_CALLS
      for (let i = 0; i < batch.calls.length; i += MAX_CONCURRENT_TOOL_CALLS) {
        if (abortSignal?.aborted) break;
        const chunk = batch.calls.slice(i, i + MAX_CONCURRENT_TOOL_CALLS);
        const chunkResults = await Promise.all(
          chunk.map(async (tc) => {
            const tool = tools.find(
              (t) => t.function.name === tc.function.name,
            );
            if (!tool) {
              return {
                toolCallId: tc.id,
                contextItems: [],
                errorMessage: `Tool "${tc.function.name}" not found`,
              } satisfies ToolCallBatchResult;
            }
            const result = await callTool(tool, tc, {
              ...extras,
              tool,
              toolCallId: tc.id,
            });
            return {
              toolCallId: tc.id,
              ...result,
            } satisfies ToolCallBatchResult;
          }),
        );
        results.push(...chunkResults);
      }
    } else {
      // Execute write calls serially
      for (const tc of batch.calls) {
        if (abortSignal?.aborted) break;
        const tool = tools.find((t) => t.function.name === tc.function.name);
        if (!tool) {
          results.push({
            toolCallId: tc.id,
            contextItems: [],
            errorMessage: `Tool "${tc.function.name}" not found`,
          });
          continue;
        }
        const result = await callTool(tool, tc, {
          ...extras,
          tool,
          toolCallId: tc.id,
        });
        results.push({ toolCallId: tc.id, ...result });
      }
    }
  }

  return results;
}
