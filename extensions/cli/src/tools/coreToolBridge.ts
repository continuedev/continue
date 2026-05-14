/**
 * coreToolBridge.ts — Phase 2+3: Core tool bridge for CLI.
 *
 * Wraps core built-in tool implementations in the CLI Tool interface using
 * CliIde for platform-specific I/O.  Tools listed here no longer maintain a
 * duplicate implementation in the CLI package — they delegate to core directly.
 *
 * Only tools whose core implementations do NOT require a live ILLM instance or
 * a fully-loaded ContinueConfig are wired here.  Complex tools (edit,
 * runTerminalCommand, subagent, …) keep their CLI-specific implementations.
 */

import { callBuiltInTool } from "core/tools/callTool.js";
import { BuiltInToolNames } from "core/tools/builtIn.js";
import { getBaseToolDefinitions } from "core/tools/index.js";
import type { ContextItem, Tool as CoreTool, ToolExtras } from "core/index.js";

import { CliIde } from "../CliIde.js";
import type { Tool, ToolRunContext } from "./types.js";

// ── Shared CliIde instance ────────────────────────────────────────────────────

let _cliIde: CliIde | undefined;

export function getCliIde(): CliIde {
  if (!_cliIde) {
    _cliIde = new CliIde();
  }
  return _cliIde;
}

// ── Minimal ContinueConfig stub ───────────────────────────────────────────────
//
// Bridged tools either do not access extras.config at all, or only touch
// config.selectedModelByRole.chat inside a null-guard (for the token-limit
// check in readFileLimit.ts — passing null skips the check silently).

const MINIMAL_CONFIG: any = {
  selectedModelByRole: {
    chat: null,
    subagent: null,
    embed: null,
    rerank: null,
    autocomplete: null,
  },
  modelsByRole: {
    subagent: [],
    chat: [],
    embed: [],
    rerank: [],
    autocomplete: [],
  },
  tools: [],
  mcpServerStatuses: [],
  rules: [],
  models: [],
  context: { providers: [] },
  tabAutocompleteOptions: {},
  docs: [],
  slashCommands: [],
  experimental: {},
};

// ── Core tool definition lookup ───────────────────────────────────────────────

let _coreToolDefMap: Map<string, CoreTool> | undefined;

function getCoreToolDefMap(): Map<string, CoreTool> {
  if (!_coreToolDefMap) {
    _coreToolDefMap = new Map<string, CoreTool>();
    for (const def of getBaseToolDefinitions()) {
      _coreToolDefMap.set(def.function.name, def);
    }
  }
  return _coreToolDefMap;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a ContextItem array returned by a core tool impl into a string. */
export function contextItemsToString(items: ContextItem[]): string {
  return items.map((item) => item.content).join("\n\n");
}

function buildToolExtras(coreTool: CoreTool, toolCallId?: string): ToolExtras {
  return {
    ide: getCliIde(),
    llm: null as any, // no bridged impl uses extras.llm
    fetch: globalThis.fetch,
    tool: coreTool,
    toolCallId,
    config: MINIMAL_CONFIG,
  };
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a CLI `Tool` that delegates its `run()` to a core built-in
 * implementation via `callBuiltInTool`.
 */
function makeCoreCliTool(
  coreToolName: BuiltInToolNames,
  overrides?: Partial<Pick<Tool, "readonly" | "preprocess">>,
): Tool {
  const coreDef = getCoreToolDefMap().get(coreToolName);
  if (!coreDef) {
    throw new Error(
      `coreToolBridge: no definition found for "${coreToolName}"`,
    );
  }

  return {
    name: coreDef.function.name,
    displayName: coreDef.displayTitle,
    description: coreDef.function.description ?? "",
    parameters: (coreDef.function.parameters ?? {
      type: "object",
      properties: {},
    }) as any,
    isBuiltIn: true,
    readonly: coreDef.readonly ?? false,
    ...overrides,
    run: async (args: any, context?: ToolRunContext): Promise<string> => {
      const extras = buildToolExtras(coreDef, context?.toolCallId);
      const contextItems = await callBuiltInTool(coreToolName, args, extras);
      return contextItemsToString(contextItems);
    },
  };
}

// ── Exported core-backed CLI tools ────────────────────────────────────────────
//
// Each of these replaces the corresponding file in extensions/cli/src/tools/.
// The tool NAME (used by the LLM) now matches core's snake_case convention
// (e.g. "sleep" instead of "Sleep").

/** Pause execution for N seconds (max 300). */
export const coreSleepTool = makeCoreCliTool(BuiltInToolNames.Sleep);

/** Show the current git diff. */
export const coreViewDiffTool = makeCoreCliTool(BuiltInToolNames.ViewDiff, {
  readonly: true,
});

/** Perform a web search. */
export const coreSearchWebTool = makeCoreCliTool(BuiltInToolNames.SearchWeb, {
  readonly: true,
});

/** Run a GitHub CLI command or query. */
export const coreGithubTool = makeCoreCliTool(BuiltInToolNames.GitHub, {
  readonly: true,
});

/** Read a file from the workspace. */
export const coreReadFileTool = makeCoreCliTool(BuiltInToolNames.ReadFile, {
  readonly: true,
});

/** Search for files matching a glob pattern. */
export const coreFileGlobSearchTool = makeCoreCliTool(
  BuiltInToolNames.FileGlobSearch,
  { readonly: true },
);

/** List directory contents. */
export const coreLsTool = makeCoreCliTool(BuiltInToolNames.LSTool, {
  readonly: true,
});

/** Write / replace the agent's todo list. */
export const coreTodoWriteTool = makeCoreCliTool(BuiltInToolNames.TodoWrite);

// Task management tools
export const coreTaskCreateTool = makeCoreCliTool(BuiltInToolNames.TaskCreate);
export const coreTaskGetTool = makeCoreCliTool(BuiltInToolNames.TaskGet, {
  readonly: true,
});
export const coreTaskListTool = makeCoreCliTool(BuiltInToolNames.TaskList, {
  readonly: true,
});
export const coreTaskOutputTool = makeCoreCliTool(BuiltInToolNames.TaskOutput, {
  readonly: true,
});
export const coreTaskStopTool = makeCoreCliTool(BuiltInToolNames.TaskStop);
export const coreTaskUpdateTool = makeCoreCliTool(BuiltInToolNames.TaskUpdate);

/** Send a message to a team mailbox. */
export const coreSendMessageTool = makeCoreCliTool(
  BuiltInToolNames.SendMessage,
);
