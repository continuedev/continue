import { execSync } from "child_process";

import type { ChatCompletionMessageParam } from "openai/resources.mjs";

/**
 * The facts about a session that change between two runs in the same folder:
 * the date and the git status. They used to sit in the system message, where
 * a changed working tree invalidated the cached prefix (tool list, system
 * text, AGENTS.md and rules) on every provider that caches it. They now go in
 * the first user message of the request, after the system checkpoint, so two
 * sessions started from the same config in the same folder read the same
 * cached prefix. Computed once per process, so the request is stable from
 * turn to turn; the stable facts (working directory, platform) stay in the
 * system message.
 */

function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getGitStatus(): string {
  try {
    if (!isGitRepo()) {
      return "Not a git repository";
    }
    const result = execSync("git status --porcelain", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });
    return result.trim() || "Working tree clean";
  } catch {
    return "Git status not available";
  }
}

export const ENVIRONMENT_BLOCK_OPEN = '<context name="environment">';
export const ENVIRONMENT_BLOCK_CLOSE = "</context>";

let block: string | undefined;

/** The block for this process, built on first use. */
export function environmentContextBlock(): string {
  if (block === undefined) {
    const today = new Date().toISOString().split("T")[0];
    block = `${ENVIRONMENT_BLOCK_OPEN}
Today's date: ${today}
Git status at the start of the session (a snapshot; it does not update during the conversation):
${getGitStatus()}
${ENVIRONMENT_BLOCK_CLOSE}`;
  }
  return block;
}

/** Forget the block, so the next request builds it again. For tests. */
export function resetEnvironmentContextBlock(): void {
  block = undefined;
}

/**
 * The request's messages with the environment block appended to the first
 * user message. Nothing is written back to the history: the block is added at
 * request time, like the task list block, so saved sessions do not carry it
 * and a resumed session gets the date and status of the run that resumed it.
 * Messages without a user message are returned as they are.
 */
export function withEnvironmentBlock(
  messages: ChatCompletionMessageParam[],
  environmentBlock: string = environmentContextBlock(),
): ChatCompletionMessageParam[] {
  const index = messages.findIndex((m) => m.role === "user");
  if (index === -1) return messages;
  const first = messages[index];
  const content = first.content;
  let appended: ChatCompletionMessageParam;
  if (typeof content === "string") {
    appended = {
      ...first,
      content: content ? `${content}\n\n${environmentBlock}` : environmentBlock,
    };
  } else if (Array.isArray(content)) {
    appended = {
      ...first,
      content: [...content, { type: "text", text: environmentBlock }],
    } as ChatCompletionMessageParam;
  } else {
    return messages;
  }
  return [...messages.slice(0, index), appended, ...messages.slice(index + 1)];
}
