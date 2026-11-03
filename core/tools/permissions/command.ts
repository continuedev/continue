/**
 * Shell command handling for tool permission rules.
 *
 * Rules must never let a command through that the user did not mean to allow,
 * and must not miss a command the user meant to deny. So:
 * - Commands are split on unquoted `&&`, `||`, `;`, `|`, `&` and newlines.
 *   Quotes and backslashes are honoured, so `echo "a && b"` is one part.
 * - Allow rules only ever apply to a command this scanner fully understands:
 *   no substitution, no unsafe expansion, no file redirection, no unterminated
 *   quote.
 * - Deny and ask rules match the command as the shell will read it: see
 *   `commandCandidates`.
 *
 * Not covered, by design: shell aliases and functions, scripts that run a
 * denied command internally, and encodings such as `echo ... | base64 -d | sh`.
 * A deny rule is a guard against accidents, not a sandbox.
 */
export interface ParsedCommand {
  /** Parts split on unquoted separators, whitespace collapsed outside quotes. */
  parts: string[];
  /** An unquoted `>` or `<` that is not a plain fd duplication like `2>&1`. */
  hasFileRedirect: boolean;
  /** An unterminated quote or a trailing backslash. */
  unparsable: boolean;
}

export function parseCommand(command: string): ParsedCommand {
  const parts: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let hasFileRedirect = false;
  let unparsable = false;
  const flush = () => {
    const t = cur.trim();
    if (t) parts.push(t);
    cur = "";
  };

  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    const next = command[i + 1];

    if (quote) {
      cur += c;
      if (c === "\\" && quote === '"' && next !== undefined) {
        cur += next;
        i++;
      } else if (c === quote) {
        quote = null;
      }
      continue;
    }

    if (c === "\\") {
      if (next === undefined) {
        unparsable = true;
      } else if (next === "\n") {
        cur += " "; // line continuation
        i++;
      } else {
        cur += c + next;
        i++;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "\n" || c === ";") {
      flush();
      continue;
    }
    if (c === "&" && next === "&") {
      flush();
      i++;
      continue;
    }
    if (c === "|") {
      flush();
      if (next === "|" || next === "&") i++;
      continue;
    }
    if (c === "&") {
      const prev = command[i - 1];
      if (prev === ">" || prev === "<") {
        cur += c; // part of `>&1` / `<&0`
      } else if (next === ">") {
        hasFileRedirect = true; // `&>file`
        cur += c;
      } else {
        flush(); // background operator
      }
      continue;
    }
    if (c === ">" || c === "<") {
      const dup = next === "&" && /[\d-]/.test(command[i + 2] ?? "");
      if (!dup) hasFileRedirect = true;
      cur += c;
      continue;
    }
    cur += /\s/.test(c) ? " " : c;
  }
  if (quote) unparsable = true;
  flush();
  return {
    parts: parts.map((p) => collapseSpaces(p)),
    hasFileRedirect,
    unparsable,
  };
}

/** Collapse runs of spaces that are not inside quotes. */
function collapseSpaces(s: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      out += c;
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
      out += c;
    } else if (c === " " && out.endsWith(" ")) {
      continue;
    } else {
      out += c;
    }
  }
  return out.trim();
}

/**
 * Constructs after which an allow rule can no longer know what will run:
 * command and process substitution, and any `${...}` that does more than read a
 * variable (`${x@P}` parses its value as a prompt string and runs `$(...)`
 * inside it; `${x:=y}` assigns). `$IFS` is refused because it splices words
 * the scanner never sees (`rg$IFS--pre=sh`). Plain `$HOME` and `${HOME}` are fine.
 * Deny and ask rules do not use this: they match more, not less.
 */
export function hasUnsafeShellConstruct(command: string): boolean {
  if (/\$\(|`|<\(|>\(/.test(command)) return true;
  if (/\$\{[^}]*[@:=#%/^,!?+-][^}]*\}/.test(command)) return true;
  return /\$\{?IFS\b/.test(command);
}

/** The parts of a command, for callers that only need the split. */
export function splitCommandParts(command: string): string[] {
  return parseCommand(command).parts;
}

/**
 * `*` matches any run of characters (including `/`), `?` matches one.
 * `ignoreCase` is for deny and ask rules: Windows commands are not case
 * sensitive, and matching more is the safe direction for a protection.
 */
export function commandGlobMatch(
  pattern: string,
  value: string,
  ignoreCase = false,
): boolean {
  let re = "^";
  for (const c of pattern) {
    if (c === "*") re += ".*";
    else if (c === "?") re += ".";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(re + "$", ignoreCase ? "is" : "s").test(value);
}
