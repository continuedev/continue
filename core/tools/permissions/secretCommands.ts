/**
 * Commands that print or send credentials without naming a secret file, and
 * paths that can leak the user's Windows credentials. Both make a call ask.
 * Words are matched exactly as written, so this works on the candidates from
 * `commandCandidates` as well as on a plain path.
 */

/**
 * Does a variable name look like it holds a credential? Whole words only,
 * split on `_`/`-`: AWS_SECRET_ACCESS_KEY and GITHUB_TOKEN match, KEYBOARD_LAYOUT
 * and MONKEY do not. Common fused forms (APIKEY, ACCESSKEY) are listed.
 */
const SECRET_WORD =
  /^(keys?|secrets?|tokens?|passw(or)?ds?|pwd|credentials?|creds?|cookies?|(api|access|private|secret|auth|signing|encryption)keys?|apitokens?|authtokens?|accesstokens?|bearer|sessions?|jwt|dsn)$/i;

function looksSecret(name: string): boolean {
  return name.split(/[_-]/).some((w) => SECRET_WORD.test(w));
}

/** `$NAME`, `${NAME}`, `%NAME%`, `$env:NAME`: the variable names a word mentions. */
export function variableNames(word: string): string[] {
  const names: string[] = [];
  const patterns = [
    /\$\{?env:([A-Za-z_]\w*)\}?/gi,
    /\$\{([A-Za-z_]\w*)[^}]*\}/g,
    /\$([A-Za-z_]\w*)/g,
    /%([A-Za-z_]\w*)%/g,
  ];
  for (const re of patterns) {
    for (let m = re.exec(word); m; m = re.exec(word)) names.push(m[1]);
  }
  return names;
}

/** A PowerShell environment drive: `env:`, `env:\`, `env:PATH`, `Env:\AWS_KEY`. */
const PS_ENV_DRIVE = /^env:(\\|\/|$|[A-Za-z_])/i;

/** `env`, `printenv`, `set`, `export`, `declare`, `compgen -v` that list the environment. */
const DUMP_COMMANDS = new Set([
  "env",
  "printenv",
  "set",
  "export",
  "declare",
  "typeset",
]);

/** Commands that print one variable when given its bare name. */
const PRINT_VARIABLE = new Set(["printenv", "echo", "printf", "write-output"]);

/**
 * A short label for what makes this word sensitive, or undefined.
 * `isFirstWord` is true for the command name, which matters for bare `env`.
 * `previous` is the command name when this word is its argument, so
 * `printenv AWS_SECRET_ACCESS_KEY` (a bare variable name) is seen too.
 */
export function secretWordLabel(
  word: string,
  isFirstWord: boolean,
  hasArgs: boolean,
  previous?: string,
): string | undefined {
  const name = word.toLowerCase();
  if (isFirstWord && DUMP_COMMANDS.has(name) && !hasArgs) {
    return "the environment variables";
  }
  if (PS_ENV_DRIVE.test(word)) {
    return "the environment variables (env:)";
  }
  if (previous && PRINT_VARIABLE.has(previous.toLowerCase())) {
    if (/^[A-Za-z_]\w*$/.test(word) && looksSecret(word)) {
      return `the variable ${word}`;
    }
  }
  for (const v of variableNames(word)) {
    if (looksSecret(v)) return `the variable ${v}`;
  }
  return undefined;
}

/**
 * A network path: `\\host\share` or `//host/share` (UNC) and the `/net/`
 * automount. Looking one up contacts the host, and on Windows that can send
 * the user's credentials to it. Check the raw text: normalising a path
 * collapses the leading double slash.
 */
export function isNetworkPath(raw: string): boolean {
  const p = raw.trim().replace(/^['"]+|['"]+$/g, "");
  return /^(\\\\|\/\/)[^\\/]+[\\/]/.test(p) || /^\/net\/[^/]+/.test(p);
}
