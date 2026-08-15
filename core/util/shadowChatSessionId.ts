import crypto from "crypto";

import { ChatMessage } from "../index.js";

export function deriveSessionId(messages: ChatMessage[]): string {
  // messages[0] may be a system message (constructMessages.ts unshifts one onto
  // every request), and that system prompt is identical across unrelated
  // conversations — hashing it would collide all of them into one session.
  const firstUser = messages.find((m) => m.role === "user");
  const content =
    typeof firstUser?.content === "string"
      ? firstUser.content
      : JSON.stringify(firstUser?.content ?? "");
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 32);
}
