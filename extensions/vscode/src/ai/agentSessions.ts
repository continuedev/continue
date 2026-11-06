import type { ChatMessage, RuleWithSource } from "core";
import type { ConfigHandler } from "core/config/ConfigHandler";
import * as vscode from "vscode";

import { runAgentTurn } from "./agentLoop";
import { toContinuedTool } from "./languageModelChatProvider";

/**
 * Continued agent sessions in VS Code's Agents window, through the proposed
 * chatSessionsProvider API (and chatParticipantPrivate for transcripts).
 *
 * Proposed APIs only work in VS Code Insiders, or in Stable started with
 * `--enable-proposed-api b1tninja.continued`, and only in the "agents" build
 * of the extension, whose package.json declares them. Everywhere else the
 * functions are missing and this does nothing. The API is still changing, so
 * every call is feature-checked.
 */

/** Must match contributes.chatSessions[].type in the agents build. */
export const SESSION_TYPE = "continued";
const SCHEME = "continued-session";
const STORE_KEY = "continued.agentSessions";
const MAX_SESSIONS = 50;
const MAX_TOOLS = 128;

interface StoredTurn {
  prompt: string;
  response: string;
}
interface StoredSession {
  id: string;
  label: string;
  createdAt: number;
  turns: StoredTurn[];
}

export function registerAgentSessions(
  context: vscode.ExtensionContext,
  configHandler: ConfigHandler,
): boolean {
  const chat = (vscode as any).chat;
  if (
    typeof chat?.createChatSessionItemController !== "function" ||
    typeof chat?.registerChatSessionContentProvider !== "function" ||
    typeof chat?.createChatParticipant !== "function"
  ) {
    return false;
  }

  const store = new SessionStore(context.globalState);
  try {
    const controller = chat.createChatSessionItemController(
      SESSION_TYPE,
      async () => refresh(),
    );
    context.subscriptions.push(controller);

    const refresh = () => {
      const items = store.all().map((s) => {
        const item = controller.createChatSessionItem(
          sessionUri(s.id),
          s.label,
        );
        item.description = new Date(s.createdAt).toLocaleString();
        return item;
      });
      if (typeof controller.items?.replace === "function") {
        controller.items.replace(items);
      } else {
        for (const item of items) controller.items?.add?.(item);
      }
    };

    controller.newChatSessionItemHandler = async (ctx: {
      request: { prompt: string };
    }) => {
      const session = store.create(ctx.request.prompt);
      return controller.createChatSessionItem(
        sessionUri(session.id),
        session.label,
      );
    };

    const handler = async (
      request: vscode.ChatRequest,
      chatContext: vscode.ChatContext,
      stream: vscode.ChatResponseStream,
      token: vscode.CancellationToken,
    ): Promise<vscode.ChatResult> => {
      const { config } = await configHandler.loadConfig();
      const llm = config?.selectedModelByRole?.chat;
      if (!llm) {
        stream.markdown(
          "Choose a chat model in Continued first (Settings > Models).",
        );
        return {};
      }
      const sessionId = sessionIdOf(
        (chatContext as any).chatSessionContext?.chatSessionItem?.resource,
      );
      const abort = new AbortController();
      const sub = token.onCancellationRequested(() => abort.abort());
      try {
        const tools = vscode.lm.tools.slice(0, MAX_TOOLS).map((t) =>
          toContinuedTool({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          }),
        );
        const response = await runAgentTurn(
          {
            llm,
            systemMessage: systemMessageFrom(config?.rules),
            history: historyFrom(chatContext),
            prompt: request.prompt,
            tools,
          },
          {
            markdown: (text) => stream.markdown(text),
            progress: (text) => stream.progress(text),
            isCancelled: () => token.isCancellationRequested,
            signal: abort.signal,
            invokeTool: async (name, input) => {
              const result = await vscode.lm.invokeTool(
                name,
                { input, toolInvocationToken: request.toolInvocationToken },
                token,
              );
              return result.content
                .map((part) =>
                  part instanceof vscode.LanguageModelTextPart
                    ? part.value
                    : JSON.stringify(part),
                )
                .join("");
            },
          },
        );
        if (sessionId) {
          store.addTurn(sessionId, { prompt: request.prompt, response });
        }
        return {};
      } finally {
        sub.dispose();
      }
    };

    const participant = chat.createChatParticipant(SESSION_TYPE, handler);
    participant.iconPath = new vscode.ThemeIcon("hubot");
    context.subscriptions.push(participant);

    context.subscriptions.push(
      chat.registerChatSessionContentProvider(
        SCHEME,
        {
          provideChatSessionContent: (resource: vscode.Uri) => {
            const session = store.get(sessionIdOf(resource) ?? "");
            return {
              history: session ? transcript(session) : [],
              requestHandler: handler,
            };
          },
        },
        participant,
        { supportsInterruptions: true },
      ),
    );
    refresh();
    return true;
  } catch (e) {
    console.warn("Continued: the Agents window integration is unavailable", e);
    return false;
  }
}

function sessionUri(id: string): vscode.Uri {
  return vscode.Uri.from({ scheme: SCHEME, path: `/${id}` });
}

function sessionIdOf(resource: vscode.Uri | undefined): string | undefined {
  if (!resource || resource.scheme !== SCHEME) return undefined;
  return resource.path.replace(/^\//, "") || undefined;
}

/** Always-applied rules without globs, as the agent's system message. */
export function systemMessageFrom(
  rules: RuleWithSource[] | undefined,
): string | undefined {
  const always = (rules ?? []).filter(
    (r) => r.alwaysApply !== false && !r.globs && !r.regex && r.rule.trim(),
  );
  return always.length
    ? always.map((r) => r.rule.trim()).join("\n\n")
    : undefined;
}

/** The session's earlier turns, as VS Code passes them to the participant. */
export function historyFrom(chatContext: vscode.ChatContext): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const turn of chatContext.history) {
    if (turn instanceof vscode.ChatRequestTurn) {
      out.push({ role: "user", content: turn.prompt });
    } else if (turn instanceof vscode.ChatResponseTurn) {
      const text = turn.response
        .map((part) =>
          part instanceof vscode.ChatResponseMarkdownPart
            ? part.value.value
            : "",
        )
        .join("");
      if (text) out.push({ role: "assistant", content: text });
    }
  }
  return out;
}

/**
 * Turns for a reopened session. Needs the chatParticipantPrivate turn
 * classes; without them the session opens empty (its turns still reach the
 * model through VS Code's history while it stays open).
 */
function transcript(session: StoredSession): unknown[] {
  const v = vscode as any;
  if (typeof v.ChatRequestTurn2 !== "function") return [];
  try {
    return session.turns.flatMap((t) => [
      new v.ChatRequestTurn2(
        t.prompt,
        undefined,
        [],
        SESSION_TYPE,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
      ),
      new v.ChatResponseTurn2(
        [new vscode.ChatResponseMarkdownPart(t.response)],
        {},
        SESSION_TYPE,
      ),
    ]);
  } catch {
    return [];
  }
}

/** Sessions kept in global state: labels, dates and turn text only. */
export class SessionStore {
  constructor(private readonly state: vscode.Memento) {}

  all(): StoredSession[] {
    return [...(this.state.get<StoredSession[]>(STORE_KEY) ?? [])].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  get(id: string): StoredSession | undefined {
    return this.all().find((s) => s.id === id);
  }

  create(prompt: string): StoredSession {
    const label = prompt.trim().split("\n")[0].slice(0, 60) || "New session";
    const session: StoredSession = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      createdAt: Date.now(),
      turns: [],
    };
    void this.save([session, ...this.all()].slice(0, MAX_SESSIONS));
    return session;
  }

  addTurn(id: string, turn: StoredTurn) {
    const sessions = this.all();
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    session.turns.push(turn);
    void this.save(sessions);
  }

  private save(sessions: StoredSession[]) {
    return this.state.update(STORE_KEY, sessions);
  }
}
