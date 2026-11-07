import type {
  ChatHistoryItem,
  ContextItem,
  LLMFullCompletionOptions,
  ModelDescription,
  SubagentRunState,
  Tool,
  ToolCallState,
  Usage,
} from "core";
import { modelSupportsNativeTools } from "core/llm/toolSupport";
import {
  DEFAULT_SUBAGENT_MAX_TURNS,
  findSubagent,
  SubagentDefinition,
} from "core/subagents/definitions";
import { resolveSubagentModel } from "core/subagents/model";
import {
  SubagentRunStatus,
  SubagentToolCallSummary,
  summarizeToolArgs,
} from "core/subagents/result";
import { resolveSubagentTools } from "core/subagents/tools";
import { applyToolOverrides } from "core/tools/applyToolOverrides";
import { flagToolOutput } from "core/tools/permissions/injection";
import { addSystemMessageToolsToSystemMessage } from "core/tools/systemMessageTools/buildToolsSystemMessage";
import { interceptSystemToolCalls } from "core/tools/systemMessageTools/interceptSystemToolCalls";
import { SystemMessageToolCodeblocksFramework } from "core/tools/systemMessageTools/toolCodeblocks";
import { ContinueError, ContinueErrorReason } from "core/util/errors";
import { renderChatMessage } from "core/util/messageContent";
import { selectCacheSetting } from "../../redux/selectors/selectCacheSetting";
import { selectActiveTools } from "../../redux/selectors/selectActiveTools";
import { selectApprovalSettings } from "../../redux/selectors/selectAutoApproval";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import {
  acceptToolCall,
  addRequestUsageToSession,
  cancelToolCall,
  errorToolCall,
  INITIAL_SESSION_STATE,
  sessionSlice,
  setProcessedToolCallArgs,
  setToolGenerated,
  streamUpdate,
  updateSubagentRun,
  updateToolCallOutput,
} from "../../redux/slices/sessionSlice";
import { evaluateToolPolicy } from "../../redux/thunks/evaluateToolPolicies";
import { constructMessages } from "../../redux/util/constructMessages";
import type {
  ClientToolExtras,
  ClientToolOutput,
} from "../clientTools/callClientTool";
import {
  INITIAL_PROMPT_CACHE_STATE,
  modelSupportsPromptCacheControl,
  promptCacheStatus,
  resolvePromptCache,
} from "../promptCache";
import { subagentResultItem } from "./interrupt";
import {
  registerSubagentRun,
  STOPPED_BY_USER,
  subagentPrefixGate,
  subagentSlots,
  waitForSubagentApproval,
} from "./registry";

type LocalSession = ReturnType<typeof sessionSlice.reducer>;

const CANCELLED_BY_PARENT = "The parent conversation was stopped";

function reasonOf(signal: AbortSignal): string {
  const reason: unknown = signal.reason;
  if (reason instanceof Error && reason.name !== "AbortError" && reason.message)
    return reason.message;
  if (typeof reason === "string" && reason) return reason;
  return CANCELLED_BY_PARENT;
}

/** What two runs must share for one to read the other's cache entry. */
function prefixKey(
  model: ModelDescription,
  systemMessage: string,
  tools: Tool[],
): string {
  return JSON.stringify([
    model.title,
    systemMessage,
    tools.map((t) => t.function.name),
  ]);
}

/** The subagent's system prompt: what it is and how to report, then its own. */
export function buildSubagentSystemMessage(
  definition: SubagentDefinition,
  workspaceDirs: string[],
): string {
  const preamble = [
    `You are "${definition.name}", a subagent. Another agent gave you one task; it sees only your final message, not your tool calls or their output.`,
    "Work on the task with the tools you have. You cannot ask the person questions, and you cannot start subagents.",
    "When you are done, reply with a self-contained report as your final message: the answer first, then the evidence (file paths and line numbers), then anything you could not finish.",
    workspaceDirs.length
      ? `Workspace folders: ${workspaceDirs.join(", ")}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");
  return definition.prompt ? `${preamble}\n\n${definition.prompt}` : preamble;
}

function addUsage(
  total: SubagentRunState["usage"],
  usage: Usage,
): SubagentRunState["usage"] {
  return {
    inputTokens: (total?.inputTokens ?? 0) + (usage.promptTokens ?? 0),
    outputTokens: (total?.outputTokens ?? 0) + (usage.completionTokens ?? 0),
    cachedTokens:
      (total?.cachedTokens ?? 0) +
      (usage.promptTokensDetails?.cachedTokens ?? 0),
  };
}

/** Text of every assistant message so far; the last one when it finished. */
function assistantTexts(history: ChatHistoryItem[]): string[] {
  return history
    .filter((item) => item.message.role === "assistant")
    .map((item) => renderChatMessage(item.message).trim())
    .filter(Boolean);
}

function lastToolCalls(local: LocalSession): ToolCallState[] {
  const last = local.history[local.history.length - 1];
  return last?.message.role === "assistant" ? (last.toolCallStates ?? []) : [];
}

function errorItem(message: string): ContextItem[] {
  return [
    {
      icon: "problems",
      name: "Tool Call Error",
      description: "Tool Call Failed",
      content: message,
      hidden: false,
    },
  ];
}

interface RunArgs {
  agent: string;
  prompt: string;
  description?: string;
}

function parseArgs(args: any): RunArgs {
  const agent = typeof args?.agent === "string" ? args.agent.trim() : "";
  const prompt = typeof args?.prompt === "string" ? args.prompt.trim() : "";
  if (!agent || !prompt) {
    throw new ContinueError(
      ContinueErrorReason.Unspecified,
      'The subagent tool needs "agent" and "prompt"',
    );
  }
  return {
    agent,
    prompt,
    description:
      typeof args?.description === "string" ? args.description : undefined,
  };
}

/**
 * Run a subagent for the parent's `subagent` tool call: a fresh conversation
 * with the agent's system prompt and the parent's tools narrowed by the
 * definition, driven from the gui because that is where the parent's tool
 * policies, approval UI and stop button live. Every call the subagent makes
 * is checked with the parent's policies; one the parent would ask about waits
 * for the person on the card. Its tool output never leaves this function: the
 * parent gets the answer and a `<task_metadata>` block.
 */
export async function runSubagentTool(
  rawArgs: any,
  toolCallId: string,
  { dispatch, getState, ideMessenger }: ClientToolExtras,
): Promise<ClientToolOutput> {
  const args = parseArgs(rawArgs);

  // Stop on the parent (and switching sessions) aborts this signal; the
  // card's Stop aborts only this run.
  const parentSignal = getState().session.streamAborter.signal;
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(new Error(CANCELLED_BY_PARENT));
  if (parentSignal.aborted) onParentAbort();
  else parentSignal.addEventListener("abort", onParentAbort, { once: true });
  const unregister = registerSubagentRun(toolCallId, controller);
  const signal = controller.signal;

  let run: SubagentRunState = {
    agent: args.agent,
    prompt: args.prompt,
    description: args.description,
    status: "queued",
    toolCalls: [],
    text: "",
  };
  const update = (patch: Partial<SubagentRunState>) => {
    run = { ...run, ...patch };
    dispatch(updateSubagentRun({ toolCallId, run: patch }));
  };
  update(run);

  let release: (() => void) | undefined;
  let childTools: Tool[] = [];
  let local: LocalSession = {
    ...INITIAL_SESSION_STATE,
    history: [
      {
        message: { role: "user", content: args.prompt, id: "subagent-prompt" },
        contextItems: [],
      },
    ],
  };
  const reduce = (action: Parameters<typeof sessionSlice.reducer>[1]) => {
    local = sessionSlice.reducer(local, action);
  };

  const finish = (status: SubagentRunStatus, error?: string) => {
    const texts = assistantTexts(local.history);
    const lastCalls = lastToolCalls(local);
    // A finished run's answer is its last message; any other run returns
    // everything it wrote, so a stopped run still hands back its findings.
    const text =
      status === "completed" && lastCalls.length === 0
        ? (texts[texts.length - 1] ?? "")
        : texts.join("\n\n");
    update({
      status,
      text,
      error,
      pendingApproval: undefined,
      endedAt: Date.now(),
      toolCalls: run.toolCalls.map((c) =>
        c.status === "calling" ? { ...c, status: "canceled" } : c,
      ),
    });
  };

  try {
    const listed = await ideMessenger.request("subagents/list", undefined);
    if (listed.status === "error") throw new Error(listed.error);
    const definition = findSubagent(listed.content.agents, args.agent);
    if (!definition) {
      throw new ContinueError(
        ContinueErrorReason.Unspecified,
        [
          `No subagent named "${args.agent}". Available: ${listed.content.agents
            .map((a) => a.name)
            .join(", ")}.`,
          ...listed.content.errors.map((e) => `Could not load ${e}`),
        ].join(" "),
      );
    }
    update({ agent: definition.name });

    const state = getState();
    const parentModel = selectSelectedChatModel(state);
    if (!parentModel) throw new Error("No chat model selected");
    const { model, fallbackReason } = resolveSubagentModel(
      definition.model,
      state.config.config.modelsByRole?.chat ?? [],
      parentModel,
    );

    // The parent's tools for its mode (disabled tools and groups already
    // removed), with this model's overrides, narrowed by the definition.
    let parentTools = selectActiveTools(state);
    if (model.toolOverrides?.length) {
      parentTools = applyToolOverrides(parentTools, model.toolOverrides).tools;
    }
    const resolved = resolveSubagentTools(definition, parentTools);
    const tools = resolved.tools;
    childTools = tools;
    const notices = [
      ...(fallbackReason ? [fallbackReason] : []),
      // Built-in agents list tools that only some setups have; only a
      // definition someone wrote is worth a note about a missing tool.
      ...(resolved.unmatched.length && definition.source !== "built-in"
        ? [`Not available here: ${resolved.unmatched.join(", ")}`]
        : []),
    ];
    update({ model: model.title, ...(notices.length && { notices }) });

    const useNativeTools = state.config.config.experimental
      ?.onlyUseSystemMessageTools
      ? false
      : modelSupportsNativeTools(model);
    const framework =
      !useNativeTools && tools.length > 0
        ? new SystemMessageToolCodeblocksFramework()
        : undefined;
    const workspaceDirs = await ideMessenger.ide
      .getWorkspaceDirs()
      .catch(() => [] as string[]);
    const baseSystem = buildSubagentSystemMessage(definition, workspaceDirs);
    const systemMessage = framework
      ? addSystemMessageToolsToSystemMessage(framework, baseSystem, tools)
      : baseSystem;

    // Prompt caching as the parent has it for this model. A fresh cache
    // state, so "auto" starts at 5 minutes: a run's requests come seconds
    // apart, and nothing here learns from them.
    const cacheSetting =
      model.title === parentModel.title ? selectCacheSetting(state) : undefined;
    const cacheOptions = resolvePromptCache(
      model,
      cacheSetting,
      INITIAL_PROMPT_CACHE_STATE,
      Date.now(),
      state.session.mode,
    ).options;
    const cachingOn =
      modelSupportsPromptCacheControl(model) &&
      promptCacheStatus(model, cacheSetting, INITIAL_PROMPT_CACHE_STATE, 0).on;
    const completionOptions: LLMFullCompletionOptions = {
      ...(useNativeTools && tools.length > 0 ? { tools } : {}),
      ...cacheOptions,
    };

    // Wait for a slot; a cancelled run gives up its place in the queue.
    release = await subagentSlots.acquire(signal);
    update({ status: "running", startedAt: Date.now() });

    const maxTurns = definition.maxTurns ?? DEFAULT_SUBAGENT_MAX_TURNS;
    for (let turn = 1; ; turn++) {
      if (signal.aborted) {
        finish("cancelled", reasonOf(signal));
        break;
      }
      if (turn > maxTurns) {
        finish("partial", `Stopped after ${maxTurns} model calls`);
        break;
      }

      const messages = constructMessages(
        local.history.map(({ message: { id, ...message }, ...rest }) => ({
          ...rest,
          message,
        })) as ChatHistoryItem[],
        systemMessage,
        [],
        {},
        framework,
      ).messages;

      // Siblings with the same model, system prompt and tools share a cached
      // prefix: the first one's request goes alone so the rest can read it.
      const gate =
        turn === 1 && cachingOn
          ? await subagentPrefixGate.enter(
              prefixKey(model, systemMessage, tools),
              signal,
            )
          : undefined;
      try {
        let gen = ideMessenger.llmStreamChat(
          { completionOptions, title: model.title, messages },
          signal,
        );
        if (framework) {
          gen = interceptSystemToolCalls(gen, controller, framework);
        }
        let next = await gen.next();
        while (!next.done) {
          gate?.opened();
          if (signal.aborted) break;
          reduce(streamUpdate(next.value));
          for (const message of next.value) {
            if (message.role === "assistant" && message.usage) {
              update({ usage: addUsage(run.usage, message.usage) });
              dispatch(
                addRequestUsageToSession({
                  provider: model.provider,
                  model: model.model,
                  usage: message.usage,
                }),
              );
            }
          }
          update({ text: assistantTexts(local.history).join("\n\n") });
          next = await gen.next();
        }
      } finally {
        gate?.opened();
      }
      if (signal.aborted) {
        finish("cancelled", reasonOf(signal));
        break;
      }

      const calls = lastToolCalls(local);
      if (calls.length === 0) {
        finish("completed");
        break;
      }
      for (const call of calls) {
        reduce(setToolGenerated({ toolCallId: call.toolCallId, tools }));
      }
      for (const call of lastToolCalls(local)) {
        if (signal.aborted) {
          reduce(cancelToolCall({ toolCallId: call.toolCallId }));
          continue;
        }
        await runChildToolCall(call);
      }
      // A tool message after the calls, as the parent's history has, so the
      // next answer starts a new assistant message. Its content is rebuilt
      // from the call's output when the request is assembled.
      for (const call of lastToolCalls(local)) {
        reduce(
          streamUpdate([
            { role: "tool", content: "", toolCallId: call.toolCallId },
          ]),
        );
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (signal.aborted) finish("cancelled", reasonOf(signal));
    else finish("failed", message);
  } finally {
    release?.();
    unregister();
    parentSignal.removeEventListener("abort", onParentAbort);
  }

  const output = [subagentResultItem(run)];
  if (parentSignal.aborted) {
    // The person stopped the parent: record the result, but do not start
    // another model call for it.
    dispatch(acceptToolCall({ toolCallId }));
    return { output, respondImmediately: false };
  }
  return { output, respondImmediately: true };

  async function runChildToolCall(call: ToolCallState): Promise<void> {
    const name = call.toolCall.function.name;
    const summary: SubagentToolCallSummary = {
      name,
      summary: summarizeToolArgs(call.parsedArgs),
      status: "calling",
    };
    const index = run.toolCalls.length;
    const setCallStatus = (status: SubagentToolCallSummary["status"]) => {
      const toolCalls = [...run.toolCalls];
      toolCalls[index] = { ...summary, status };
      update({ toolCalls });
    };
    update({ toolCalls: [...run.toolCalls, summary] });

    const fail = (message: string) => {
      reduce(
        errorToolCall({
          toolCallId: call.toolCallId,
          output: errorItem(message),
        }),
      );
      setCallStatus("errored");
    };

    const tools = childTools;
    if (!tools.some((t) => t.function.name === name)) {
      fail(`${name} is not available to this subagent.`);
      return;
    }

    try {
      let current = findLocalCall(call.toolCallId) ?? call;
      const pre = await ideMessenger.request("tools/preprocessArgs", {
        toolName: name,
        args: current.parsedArgs ?? {},
      });
      if (pre.status === "success") {
        if (pre.content.errorMessage) {
          fail(pre.content.errorMessage);
          return;
        }
        if (pre.content.preprocessedArgs) {
          reduce(
            setProcessedToolCallArgs({
              toolCallId: call.toolCallId,
              newArgs: pre.content.preprocessedArgs,
            }),
          );
        }
      }
      current = findLocalCall(call.toolCallId) ?? current;

      const policy = await evaluateToolPolicy(
        ideMessenger,
        tools,
        current,
        getState().ui.toolSettings,
        selectApprovalSettings(getState()),
      );
      if (policy.policy === "disabled") {
        fail(
          `${name} was refused by the person's tool policies${
            policy.reason ? `: ${policy.reason}` : ""
          }.`,
        );
        return;
      }
      if (policy.policy === "allowedWithPermission") {
        const approvalId = `${toolCallId}:${call.toolCallId}`;
        update({
          pendingApproval: {
            id: approvalId,
            toolName: name,
            summary: policy.displayValue ?? summary.summary,
            ...(policy.reason && { note: policy.reason }),
          },
        });
        const allowed = await waitForSubagentApproval(approvalId, signal);
        update({ pendingApproval: undefined });
        if (!allowed) {
          reduce(cancelToolCall({ toolCallId: call.toolCallId }));
          setCallStatus("canceled");
          return;
        }
      }

      const result = await ideMessenger.request("tools/call", {
        toolCall: current.toolCall,
      });
      if (result.status === "error") {
        fail(result.error);
        return;
      }
      if (result.content.errorMessage) {
        fail(`${name} failed with the message: ${result.content.errorMessage}`);
        return;
      }
      const { items } = flagToolOutput(result.content.contextItems ?? []);
      reduce(
        updateToolCallOutput({
          toolCallId: call.toolCallId,
          contextItems: items,
        }),
      );
      reduce(acceptToolCall({ toolCallId: call.toolCallId }));
      setCallStatus("done");
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  function findLocalCall(id: string): ToolCallState | undefined {
    return lastToolCalls(local).find((c) => c.toolCallId === id);
  }
}
