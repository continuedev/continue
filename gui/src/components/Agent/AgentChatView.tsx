/**
 * AgentChatView — renders the live view of an agent session.
 *
 * Accepts a sessionId, polls agent/status every 1.5 s, and displays:
 *   - AgentStatusBar (turn count + abort button)
 *   - The conversation: user prompt, assistant reasoning, tool calls + results
 *   - AskUserQuestion UI when the agent needs clarification
 *
 * This component is rendered by Chat.tsx when mode === "agent" and an
 * agent session is active.
 */

import { ChatMessage } from "core";
import { AskUserQuestion } from "core/tools/definitions/askUserQuestion";
import { renderChatMessage } from "core/util/messageContent";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { AgentSessionStatus, AgentStatusBar } from "./AgentStatusBar";
import { AgentToolCallItem } from "./AgentToolCallItem";

const POLL_INTERVAL_MS = 1500;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AgentChatViewProps {
  sessionId: string;
  /** Called once the session reaches a terminal state so Chat.tsx can reset */
  onSessionEnd?: () => void;
}

interface AgentStatusSnapshot {
  status: AgentSessionStatus;
  stopReason?: string;
  totalTurns: number;
  messages: ChatMessage[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isTerminal(status: AgentSessionStatus): boolean {
  return status === "completed" || status === "failed" || status === "killed";
}

/** Pair assistant message with the immediately following tool messages */
type MessageGroup =
  | { kind: "user"; message: ChatMessage }
  | { kind: "thinking"; content: string }
  | { kind: "assistant"; content: string; toolCalls: ToolCallGroup[] };

interface ToolCallGroup {
  id: string;
  name: string;
  args: string;
  result?: string;
  error?: string;
}

function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === "system") {
      i++;
      continue;
    }

    if (msg.role === "user") {
      const content = renderChatMessage(msg);
      if (content?.trim()) {
        groups.push({ kind: "user", message: msg });
      }
      i++;
      continue;
    }

    if (msg.role === "thinking") {
      const content = renderChatMessage(msg);
      if (content?.trim()) {
        groups.push({ kind: "thinking", content });
      }
      i++;
      continue;
    }

    if (msg.role === "assistant") {
      const assistantMsg = msg as any;
      const textContent = renderChatMessage(msg) ?? "";
      const toolCallGroups: ToolCallGroup[] = [];

      // Collect tool calls from this assistant message
      if (assistantMsg.toolCalls) {
        for (const tc of assistantMsg.toolCalls) {
          if (!tc.id || !tc.function?.name) continue;
          toolCallGroups.push({
            id: tc.id,
            name: tc.function.name,
            args: tc.function.arguments ?? "{}",
          });
        }
      }

      // Now scan ahead for matching tool-result messages
      let j = i + 1;
      while (j < messages.length && messages[j].role === "tool") {
        const toolMsg = messages[j] as any;
        const tcId = toolMsg.toolCallId ?? toolMsg.id;
        const group = toolCallGroups.find((g) => g.id === tcId);
        if (group) {
          const rawContent = Array.isArray(toolMsg.content)
            ? toolMsg.content
                .map((c: any) =>
                  typeof c === "string" ? c : (c.text ?? JSON.stringify(c)),
                )
                .join("\n")
            : typeof toolMsg.content === "string"
              ? toolMsg.content
              : JSON.stringify(toolMsg.content);

          if (toolMsg.error) {
            group.error = rawContent;
          } else {
            group.result = rawContent;
          }
        }
        j++;
      }

      groups.push({
        kind: "assistant",
        content: textContent,
        toolCalls: toolCallGroups,
      });
      i = j;
      continue;
    }

    // skip unrecognised roles
    i++;
  }
  return groups;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AgentChatView({ sessionId, onSessionEnd }: AgentChatViewProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const [snapshot, setSnapshot] = useState<AgentStatusSnapshot>({
    status: "pending",
    totalTurns: 0,
    messages: [],
  });

  // AskUserQuestion state: questions sent by the agent
  const [pendingQuestions, setPendingQuestions] = useState<
    AskUserQuestion[] | null
  >(null);
  // Map from question text → selected answer
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await ideMessenger.request("agent/status", { sessionId });
        if (cancelled) return;
        if (res.status === "success") {
          const data = res.content;
          setSnapshot({
            status: data.status as AgentSessionStatus,
            stopReason: data.stopReason,
            totalTurns: data.totalTurns,
            messages: data.messages,
          });

          if (isTerminal(data.status as AgentSessionStatus)) {
            onSessionEnd?.();
            return;
          }
        }
      } catch {
        // silent — keep polling
      }
      if (!cancelled) {
        timerId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [sessionId, ideMessenger, onSessionEnd]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [snapshot.messages.length]);

  // Listen for AskUserQuestion events from the agent
  useWebviewListener(
    "agent/askUserQuestion",
    async (data) => {
      if (data.sessionId === sessionId) {
        setPendingQuestions(data.questions);
        setAnswers({});
      }
    },
    [sessionId],
  );

  // ── Abort ─────────────────────────────────────────────────────────────────
  const handleAbort = useCallback(async () => {
    await ideMessenger.request("agent/abort", { sessionId });
  }, [sessionId, ideMessenger]);

  // ── AskUserQuestion answer submission ─────────────────────────────────────
  const handleSubmitAnswers = useCallback(async () => {
    if (!pendingQuestions) return;
    await ideMessenger.request("agent/questionAnswer", {
      sessionId,
      answers,
    });
    setPendingQuestions(null);
    setAnswers({});
  }, [pendingQuestions, answers, sessionId, ideMessenger]);

  // ── Render ────────────────────────────────────────────────────────────────
  const groups = groupMessages(snapshot.messages);
  const isActive =
    snapshot.status === "running" || snapshot.status === "pending";

  return (
    <div className="flex h-full flex-col gap-2 px-2 py-2">
      {/* Status bar */}
      <AgentStatusBar
        status={snapshot.status}
        totalTurns={snapshot.totalTurns}
        stopReason={snapshot.stopReason}
        onAbort={handleAbort}
      />

      {/* Message feed */}
      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 space-y-3 overflow-y-auto"
      >
        {groups.map((group, i) => {
          if (group.kind === "user") {
            const text = renderChatMessage(group.message) ?? "";
            return (
              <div
                key={i}
                className="ml-auto max-w-[85%] rounded-lg bg-blue-600/20 px-3 py-2 text-sm text-zinc-200"
              >
                {text}
              </div>
            );
          }

          if (group.kind === "thinking") {
            return (
              <details key={i} className="text-xs text-zinc-500">
                <summary className="cursor-pointer select-none">
                  Thinking…
                </summary>
                <pre className="mt-1 whitespace-pre-wrap break-all pl-2">
                  {group.content}
                </pre>
              </details>
            );
          }

          if (group.kind === "assistant") {
            return (
              <div key={i} className="space-y-1">
                {group.content.trim() && (
                  <p className="text-sm text-zinc-200">{group.content}</p>
                )}
                {group.toolCalls.map((tc, j) => {
                  // A tool call is still running when it has no result/error
                  // and the session is still active
                  const stillRunning =
                    tc.result === undefined &&
                    tc.error === undefined &&
                    isActive;
                  return (
                    <AgentToolCallItem
                      key={`${i}-${j}`}
                      toolName={tc.name}
                      args={tc.args}
                      result={tc.result}
                      error={tc.error}
                      isRunning={stillRunning}
                    />
                  );
                })}
              </div>
            );
          }

          return null;
        })}

        {/* Empty state while pending */}
        {snapshot.status === "pending" && groups.length === 0 && (
          <p className="text-center text-xs text-zinc-500">
            Starting agent session…
          </p>
        )}
      </div>

      {/* AskUserQuestion panel */}
      {pendingQuestions && (
        <div className="rounded-lg border border-blue-500/40 bg-zinc-800 p-3 text-sm">
          <p className="mb-3 font-semibold text-zinc-200">
            The agent has a question for you:
          </p>
          {pendingQuestions.map((q, qi) => (
            <div key={qi} className="mb-4">
              <p className="mb-2 text-zinc-300">{q.question}</p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.question]: opt.label,
                      }))
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      answers[q.question] === opt.label
                        ? "border-blue-500 bg-blue-600/30 text-blue-300"
                        : "border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={handleSubmitAnswers}
            disabled={pendingQuestions.some((q) => !answers[q.question])}
            className="mt-1 rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
