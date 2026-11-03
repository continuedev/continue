/**
 * Shell word handling for tool permission rules. The goal is to see the same
 * command the shell will run, so a rule on `git push` also meets `git 'push'`,
 * `g\it push`, `$'\x67it' push` and `"/usr/bin/git" push`.
 *
 * This is quote removal and splitting only. It does no expansion: a `$VAR` stays
 * a `$VAR`, and a glob stays a glob.
 */

const ANSI_C: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  a: "\x07",
  b: "\b",
  e: "\x1b",
  E: "\x1b",
  f: "\f",
  v: "\v",
  "\\": "\\",
  "'": "'",
  '"': '"',
  "?": "?",
};

/** Decode the inside of `$'...'`: \xHH, \NNN octal, \uHHHH and the usual escapes. */
function decodeAnsiC(body: string): string {
  let out = "";
  for (let j = 0; j < body.length; j++) {
    if (body[j] !== "\\" || j + 1 >= body.length) {
      out += body[j];
      continue;
    }
    const n = body[j + 1];
    const rest = body.slice(j + 2);
    const hex = n === "x" ? /^[0-9a-fA-F]{1,2}/.exec(rest) : null;
    const uni = n === "u" ? /^[0-9a-fA-F]{1,4}/.exec(rest) : null;
    const oct = /[0-7]/.test(n) ? /^[0-7]{1,3}/.exec(body.slice(j + 1)) : null;
    if (hex || uni) {
      const m = (hex ?? uni)!;
      out += String.fromCharCode(parseInt(m[0], 16));
      j += 1 + m[0].length;
    } else if (oct) {
      out += String.fromCharCode(parseInt(oct[0], 8));
      j += oct[0].length;
    } else {
      out += ANSI_C[n] ?? `\\${n}`;
      j += 1;
    }
  }
  return out;
}

/** POSIX-style quote removal for one word: '..', "..", $'..', $"..", and \x. */
export function dequote(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\") {
      if (i + 1 < raw.length) out += raw[++i];
    } else if (c === "$" && raw[i + 1] === "'") {
      const end = raw.indexOf("'", i + 2);
      out += decodeAnsiC(raw.slice(i + 2, end < 0 ? undefined : end));
      if (end < 0) break;
      i = end;
    } else if (c === "'") {
      const end = raw.indexOf("'", i + 1);
      out += raw.slice(i + 1, end < 0 ? undefined : end);
      if (end < 0) break;
      i = end;
    } else if (c === '"' || (c === "$" && raw[i + 1] === '"')) {
      let j = c === "$" ? i + 2 : i + 1;
      for (; j < raw.length && raw[j] !== '"'; j++) {
        if (raw[j] === "\\" && '"\\$`'.includes(raw[j + 1] ?? "")) j++;
        out += raw[j];
      }
      i = j;
    } else {
      out += c;
    }
  }
  return out;
}

/** Split on whitespace outside quotes, keeping each word's quotes and escapes. */
export function splitRawWords(text: string): string[] {
  const words: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      cur += c;
      if (c === "\\" && quote === '"' && i + 1 < text.length) cur += text[++i];
      else if (c === quote) quote = null;
    } else if (c === "\\") {
      cur += c;
      if (i + 1 < text.length) cur += text[++i];
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
    } else if (/\s/.test(c)) {
      if (cur) words.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur) words.push(cur);
  return words;
}

/** The text inside `$(...)`, `<(...)`, `>(...)` and backticks, nested ones included. */
export function extractSubstitutions(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ((c === "$" || c === "<" || c === ">") && text[i + 1] === "(") {
      let depth = 1;
      let j = i + 2;
      for (; j < text.length && depth > 0; j++) {
        if (text[j] === "(") depth++;
        else if (text[j] === ")") depth--;
      }
      out.push(text.slice(i + 2, depth === 0 ? j - 1 : j));
    } else if (c === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > 0) {
        out.push(text.slice(i + 1, end));
        i = end;
      }
    }
  }
  return out;
}

/** Drop group openers and closers that cling to a word: `(git`, `{`, `push)`, `$(git`. */
export function stripGrouping(word: string): string {
  return word.replace(/^(?:\$\(|<\(|>\(|[({!`])+/, "").replace(/[)}`;]+$/, "");
}

/**
 * What a command word really names: no directory, no .exe/.cmd/.bat, lower
 * case. `/usr/bin/Git`, `git.exe` and `C:\Git\bin\git.exe` all become `git`.
 */
export function commandName(word: string): string {
  const w = stripGrouping(word);
  const base = w.split(/[\\/]/).pop() || w;
  return base.replace(/\.(exe|cmd|bat|com)$/i, "").toLowerCase();
}
