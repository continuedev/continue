/**
 * Shell command handling for tool permission rules.
 *
 * Rules must never let a command through that the user did not mean to allow,
 * and must not miss a command the user meant to deny. So:
 * - Commands are split on unquoted `&&`, `||`, `;`, `|`, `&` and newlines.
 *   Quotes and backslashes are honoured, so `echo "a && b"` is one part.
 * - Allow rules only ever apply to a command this scanner fully understands:
 *   no substitution, no file redirection, no unterminated quote.
 * - Deny and ask rules over-match on purpose: they are also tried against
 *   every word-suffix of each part (so `sudo git push` matches `git push*`)
 *   and against the script inside `bash -c '...'`.
 *
 * Not covered, by design: shell aliases, functions, `eval`, scripts that run
 * a denied command internally, and command names that differ only in case.
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

/** Command substitution and process substitution, which can run anything. */
export function hasUnsafeShellConstruct(command: string): boolean {
  return /\$\(|`|<\(|>\(/.test(command);
}

/** The parts of a command, for callers that only need the split. */
export function splitCommandParts(command: string): string[] {
  return parseCommand(command).parts;
}

/** `*` matches any run of characters (including `/`), `?` matches one. */
export function commandGlobMatch(pattern: string, value: string): boolean {
  let re = "^";
  for (const c of pattern) {
    if (c === "*") re += ".*";
    else if (c === "?") re += ".";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(re + "$", "s").test(value);
}

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);

/** Strip one layer of matching quotes. */
function unquote(s: string): string {
  if (s.length >= 2 && (s[0] === "'" || s[0] === '"') && s.at(-1) === s[0]) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Every string a deny or ask rule should be tried against for one command
 * part: the part itself, each word-suffix of it (so a leading `sudo`, `env X=1`
 * or `time` does not hide the command), and, for `bash -c '<script>'`, the
 * parts of the script. This only ever adds candidates, so it can make a deny
 * or ask rule match more, never less.
 */
export function ruleCandidates(part: string, depth = 0): string[] {
  const out = new Set<string>([part]);
  const words = part.split(" ");
  for (let i = 1; i < words.length; i++) out.add(words.slice(i).join(" "));

  if (depth < 3) {
    for (let i = 0; i < words.length - 2; i++) {
      const name = words[i].split("/").pop() ?? words[i];
      if (SHELLS.has(name) && /^-[a-z]*c[a-z]*$/.test(words[i + 1])) {
        const script = unquote(words.slice(i + 2).join(" "));
        for (const inner of parseCommand(script).parts) {
          for (const c of ruleCandidates(inner, depth + 1)) out.add(c);
        }
        break;
      }
    }
  }
  return [...out];
}
