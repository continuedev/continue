import type { ModelConfig } from "@continuedev/config-yaml";
import type { BaseLlmApi } from "@continuedev/openai-adapters";
import { render } from "ink-testing-library";
import type { ChatCompletionChunk } from "openai/resources/chat/completions.mjs";
import React from "react";

import { toolPermissionManager } from "../../permissions/permissionManager.js";
import type { PermissionMode } from "../../permissions/types.js";
import { serviceContainer, services } from "../../services/index.js";
import { SERVICE_NAMES } from "../../services/types.js";
import { updateSessionPlanFile, updateSessionTaskPlan } from "../../session.js";
import { messageQueue } from "../../stream/messageQueue.js";
import { AppRoot } from "../AppRoot.js";

/**
 * A harness for end-to-end flows through the TUI: the real AppRoot, useChat,
 * streamChatResponse, tool permissions, tools and chat history, with only the
 * model replaced by a script. Each request the agent loop makes takes the
 * next turn of the script and is recorded, so a test can assert what the
 * model was sent.
 */

export const ENTER = "\r";
export const ESC = "\x1b";
export const SHIFT_TAB = "\x1b[Z";

export function chunk(delta: any, finish: string | null = null) {
  return {
    id: "test",
    object: "chat.completion.chunk",
    created: 0,
    model: "test-model",
    choices: [{ index: 0, delta, finish_reason: finish as any }],
  } as ChatCompletionChunk;
}

/** A reply that is only text. */
export function textTurn(content: string): ChatCompletionChunk[] {
  return [chunk({ content }), chunk({}, "stop")];
}

/** A reply that makes one tool call. */
export function toolTurn(
  name: string,
  args: Record<string, unknown>,
  id = `call_${name}`,
): ChatCompletionChunk[] {
  return [
    chunk({
      tool_calls: [
        {
          index: 0,
          id,
          type: "function",
          function: { name, arguments: JSON.stringify(args) },
        },
      ],
    }),
    chunk({}, "tool_calls"),
  ];
}

export interface RecordedRequest {
  messages: Array<{ role: string; content: any; tool_call_id?: string }>;
  tools: Array<{ function: { name: string } }>;
}

/** Text of a request message, whether it is a string or content parts. */
export function messageText(message: { content: any }): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .join("");
  }
  return "";
}

/** A turn is its chunks, or a function that resolves to them later. */
export type ScriptTurn =
  | ChatCompletionChunk[]
  | ((signal: AbortSignal) => Promise<ChatCompletionChunk[]>);

export class ScriptedLlm {
  readonly requests: RecordedRequest[] = [];
  private turns: ScriptTurn[];

  constructor(turns: ScriptTurn[]) {
    this.turns = [...turns];
  }

  get api(): BaseLlmApi {
    const self = this;
    return {
      chatCompletionStream: (body: any, signal: AbortSignal) =>
        (async function* () {
          self.requests.push({
            messages: JSON.parse(JSON.stringify(body.messages)),
            tools: body.tools ?? [],
          });
          const turn = self.turns.shift() ?? textTurn("(script ended)");
          const chunks = typeof turn === "function" ? await turn(signal) : turn;
          for (const c of chunks) {
            if (signal?.aborted) return;
            yield c;
          }
        })(),
    } as unknown as BaseLlmApi;
  }
}

/** A turn held until `release()`, or until the run is stopped. */
export function heldTurn(chunks: ChatCompletionChunk[]) {
  let release!: () => void;
  let started!: () => void;
  const released = new Promise<void>((r) => (release = r));
  const startedPromise = new Promise<void>((r) => (started = r));
  const state = { aborted: false };
  const turn: ScriptTurn = async (signal) => {
    started();
    await new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      signal.addEventListener("abort", () => resolve(), { once: true });
      void released.then(resolve);
    });
    state.aborted = signal.aborted;
    return signal.aborted ? [] : chunks;
  };
  return {
    turn,
    release,
    started: startedPromise,
    /** Whether the request's signal was aborted while it was held. */
    wasAborted: () => state.aborted,
  };
}

export const testModel = {
  provider: "openai",
  name: "test-model",
  model: "test-model",
  defaultCompletionOptions: { contextLength: 200_000, maxTokens: 1000 },
} as unknown as ModelConfig;

export interface FlowSetup {
  llm: ScriptedLlm;
  mode?: PermissionMode;
  /** Extra models in the assistant config, e.g. a subagent. */
  extraModels?: any[];
  /** Tools the MCP service reports. */
  mcpTools?: any[];
}

/**
 * Registers the services the TUI and the agent loop read, with the scripted
 * model, in the real service container.
 */
export async function registerFlowServices({
  llm,
  mode = "normal",
  extraModels = [],
  mcpTools = [],
}: FlowSetup) {
  const assistant = {
    name: "flow-test",
    version: "1.0.0",
    models: [testModel, ...extraModels],
    rules: [],
    mcpServers: [],
  } as any;
  serviceContainer.registerValue(SERVICE_NAMES.AUTH, {
    authConfig: null,
    isAuthenticated: false,
  });
  serviceContainer.registerValue(SERVICE_NAMES.API_CLIENT, {
    apiClient: null,
  });
  serviceContainer.registerValue(SERVICE_NAMES.CONFIG, {
    config: assistant,
    configPath: undefined,
  });
  serviceContainer.registerValue(SERVICE_NAMES.MODEL, {
    llmApi: llm.api,
    model: testModel,
    assistant,
    authConfig: null,
  });
  serviceContainer.registerValue(SERVICE_NAMES.MCP, {
    mcpService: null,
    connections: [],
    tools: mcpTools,
    prompts: [],
  });
  serviceContainer.registerValue(SERVICE_NAMES.UPDATE, {
    autoUpdate: false,
    isAutoUpdate: false,
    status: "idle",
    message: "",
    isUpdateAvailable: false,
    latestVersion: null,
    currentVersion: "0.0.0-test",
  });
  await services.toolPermissions.doInitialize({ mode, isHeadless: false });
}

/**
 * Clears what the singletons keep between renders: the queue, the task list,
 * open prompts and questions, and the chat history (which the next render
 * would otherwise show before it starts its own session).
 */
export async function resetFlowState() {
  messageQueue.clear();
  messageQueue.resume();
  updateSessionTaskPlan(undefined);
  updateSessionPlanFile(undefined);
  for (const id of toolPermissionManager.getPendingRequestIds()) {
    toolPermissionManager.rejectRequest(id);
  }
  await services.quiz.initialize();
  await services.chatHistory.initialize(undefined);
}

export function renderFlow(): ReturnType<typeof render> & {
  allOutput: () => string;
} {
  const result = render(React.createElement(AppRoot));
  /** Everything written so far, static output included. */
  const allOutput = () => result.frames.join("\n");
  return { ...result, allOutput };
}

/** Polls until `predicate` holds, failing with the last frame on timeout. */
export async function waitUntil(
  predicate: () => boolean,
  describe: string,
  lastFrame: () => string | undefined,
  timeoutMs = 5000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      // A component's input handler subscribes in an effect, after the
      // frame that shows it, so let effects run before the next key.
      await tick(100);
      return;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(
    `Timed out waiting for ${describe}. Last frame:\n${lastFrame() ?? ""}`,
  );
}

/** Lets Ink process input and re-render. */
export function tick(ms = 50): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Types text and lets the input handler see it before the next key. */
export async function type(
  stdin: { write: (s: string) => void },
  text: string,
): Promise<void> {
  stdin.write(text);
  await tick();
}
