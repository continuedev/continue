/**
 * True when `raw` stops part-way through a JSON value: inside a string or with
 * an object or array still open. That is what a tool call looks like when the
 * model hit its output limit while writing the arguments. Complete but
 * malformed JSON is not truncated, so the lenient parser can still repair it.
 */
export function isTruncatedJson(raw: string): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const ch of raw) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
    }
  }
  return inString || depth > 0;
}

/** What the model sees when its tool call was cut off and not run. */
export function truncatedToolCallResult(
  toolName: string,
  maxTokens: number | undefined,
): string {
  const limit = maxTokens ? ` of ${maxTokens} tokens` : "";
  return `Your ${toolName} call was cut off at the output limit${limit}, so it was not run and nothing was written. ${toolName === "create_new_file" ? "Send it again in smaller pieces: create the file with its first part, then call create_new_file with append set to true for each further part." : "Send it again in smaller pieces, each in its own call."}`;
}
