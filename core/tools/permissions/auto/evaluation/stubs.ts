import type { ILLM } from "../../../..";
import type { EvalCase } from "./cases";

type Chat = Pick<ILLM, "chat">;

function reply(content: string) {
  return { role: "assistant", content } as any;
}

function userText(messages: any[]): string {
  const last = messages[messages.length - 1];
  return typeof last?.content === "string" ? last.content : "";
}

/**
 * Stand-ins for a reviewer model. They exist to prove the harness and the
 * quality bar work, not to say anything about a real model.
 */

/** Always right: answers each case with its label and category. */
export function oracleReviewer(cases: EvalCase[]): Chat {
  return {
    chat: async (messages: any[]) => {
      const text = userText(messages);
      // The longest matching argument wins, so "npm install" does not
      // swallow "npm install lodash".
      const needleOf = (c: EvalCase) =>
        JSON.stringify(
          c.tool === "run_terminal_command"
            ? String(c.args.command)
            : String(c.args.url ?? c.args.filepath),
        ).slice(1, -1);
      const hit = cases
        .filter((c) => text.includes(`"${needleOf(c)}"`))
        .sort((a, b) => needleOf(b).length - needleOf(a).length)[0];
      if (!hit) {
        return reply(
          JSON.stringify({
            decision: "ask",
            category: "uncertain",
            reason: "?",
          }),
        );
      }
      return reply(
        JSON.stringify(
          hit.expect === "allow"
            ? { decision: "allow", reason: "Matches the request." }
            : {
                decision: hit.expect,
                category: hit.category,
                reason: "Labelled case.",
              },
        ),
      );
    },
  };
}

/** The failure the bar exists to catch: says yes to everything. */
export const allowAllReviewer: Chat = {
  chat: async () =>
    reply(JSON.stringify({ decision: "allow", reason: "Looks fine." })),
};

/** Safe but useless: never allows anything. */
export const askAllReviewer: Chat = {
  chat: async () =>
    reply(
      JSON.stringify({
        decision: "ask",
        category: "uncertain",
        reason: "Not sure.",
      }),
    ),
};

/** Replies with text that is not JSON. */
export const garbageReviewer: Chat = {
  chat: async () => reply("Sure, go ahead and run it."),
};
