import { parseCommand } from "./command";
import {
  commandName,
  dequote,
  extractSubstitutions,
  splitRawWords,
  stripGrouping,
} from "./shellWords";

/**
 * Every string a deny or ask rule should be tried against for a command.
 * It reads the command the way the shell will: quotes and escapes removed
 * (`git 'push'`, `g\it`, `$'\x67it'`), directories and `.exe` dropped from the
 * command name, `git -C x -c y push` read as `git push`, wrappers such as
 * `sudo`, `env` and `timeout` skipped, and the commands inside `$(...)`,
 * `bash -c`, `powershell -Command`, `python -c`, `eval`, `xargs` and pipes
 * into a shell included. It only ever adds candidates, so a deny or ask rule
 * can match more, never less.
 */
const POSIX_SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish"]);
const PS_SHELLS = new Set(["powershell", "pwsh"]);
const INTERPRETER = /^(python|node|nodejs|deno|bun|perl|ruby|php|lua)[\d.]*$/;
const INLINE_FLAGS = new Set(["-c", "-e", "-p", "-r", "--eval", "--print"]);
const GIT_OPTS_WITH_ARG = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--exec-path",
  "--super-prefix",
  "--config-env",
]);
const XARGS_OPTS_WITH_ARG = new Set(["-n", "-I", "-P", "-d", "-L", "-s", "-E"]);
const MAX_DEPTH = 4;
const MAX_CANDIDATES = 800;

/** Text inside matching quotes, for scripts passed to `python -c`, `sh <<<` and similar. */
function quotedLiterals(text: string): string[] {
  const out: string[] = [];
  const re = /(["'])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push(m[2]);
  return out;
}

function skipGitOptions(tail: string[]): string[] {
  let i = 0;
  while (i < tail.length && tail[i].startsWith("-")) {
    i += GIT_OPTS_WITH_ARG.has(tail[i]) ? 2 : 1;
  }
  return tail.slice(i);
}

function unquoteWord(word: string): string {
  return dequote(stripGrouping(word));
}

/** Scripts a command word can run, so a rule sees the command inside them. */
function nested(
  name: string,
  tail: string[],
  depth: number,
  out: Set<string>,
): void {
  const run = (script: string | undefined) => {
    if (script) addCommand(script, depth + 1, out);
  };
  if (POSIX_SHELLS.has(name)) {
    const k = tail.findIndex((w) => /^-[a-z]*c[a-z]*$/.test(w));
    if (k >= 0) run(tail[k + 1]);
  } else if (PS_SHELLS.has(name)) {
    const k = tail.findIndex((w) => /^-(c|command)$/i.test(w));
    if (k >= 0) run(tail.slice(k + 1).join(" "));
  } else if (name === "cmd") {
    const k = tail.findIndex((w) => /^\/[ck]$/i.test(w));
    if (k >= 0) run(tail.slice(k + 1).join(" "));
  } else if (name === "eval") {
    run(tail.join(" "));
  } else if (INTERPRETER.test(name)) {
    const k = tail.findIndex((w) => INLINE_FLAGS.has(w.toLowerCase()));
    if (k >= 0 && tail[k + 1]) {
      for (const lit of quotedLiterals(tail[k + 1])) run(lit);
    }
  }
}

function addPart(part: string, depth: number, out: Set<string>): void {
  if (out.size > MAX_CANDIDATES) return;
  out.add(part);
  const rawWords = splitRawWords(part).map(stripGrouping).filter(Boolean);
  const words = rawWords.map(dequote).filter(Boolean);
  if (words.length === 0) return;
  out.add(words.join(" "));

  for (let i = 0; i < rawWords.length; i++) {
    const tail = rawWords.slice(i + 1).map(unquoteWord);
    // A Windows path keeps its backslashes in the raw word; `g\it` loses them.
    // Try both readings of the command word.
    const names = new Set([
      commandName(unquoteWord(rawWords[i])),
      commandName(rawWords[i]),
    ]);
    for (const name of names) {
      if (!name) continue;
      out.add([name, ...tail].join(" "));
      if (name === "git") out.add(["git", ...skipGitOptions(tail)].join(" "));
      if (depth < MAX_DEPTH) nested(name, tail, depth, out);
    }
  }
}

/** Each part of a command, plus what is inside substitutions, scripts and simple variables. */
function addCommand(command: string, depth: number, out: Set<string>): void {
  if (out.size > MAX_CANDIDATES) return;
  const parts = parseCommand(command).parts;
  const vars: Record<string, string> = {};

  for (const p of parts) {
    addPart(p, depth, out);
    const assign = /^([A-Za-z_]\w*)=(\S*)$/.exec(p);
    if (assign) {
      vars[assign[1]] = dequote(assign[2]);
    } else if (/\$/.test(p) && Object.keys(vars).length > 0) {
      const expanded = p.replace(/\$\{?([A-Za-z_]\w*)\}?/g, (s, n) =>
        n in vars ? vars[n] : s,
      );
      if (expanded !== p) addPart(expanded, depth, out);
    }
  }
  if (depth >= MAX_DEPTH) return;

  for (const sub of extractSubstitutions(command)) {
    addCommand(sub, depth + 1, out);
  }

  const names = parts.map((p) =>
    commandName(unquoteWord(splitRawWords(p)[0] ?? "")),
  );
  // `echo '...' | sh`, `sh <<< '...'`: text fed to a shell is a script.
  const feedsShell =
    /<<</.test(command) ||
    names.some(
      (n, i) => POSIX_SHELLS.has(n) && !/\s-[a-z]*c\b/.test(" " + parts[i]),
    );
  if (feedsShell) {
    for (const p of parts) {
      for (const lit of quotedLiterals(p)) addCommand(lit, depth + 1, out);
    }
  }
  // `echo push | xargs git` runs `git push`.
  parts.forEach((p, i) => {
    if (names[i] !== "xargs") return;
    const w = splitRawWords(p).slice(1).map(unquoteWord);
    let k = 0;
    while (k < w.length && w[k].startsWith("-")) {
      k += XARGS_OPTS_WITH_ARG.has(w[k]) ? 2 : 1;
    }
    const tail = w.slice(k).join(" ");
    if (!tail) return;
    parts.forEach((q, j) => {
      if (j !== i && (names[j] === "echo" || names[j] === "printf")) {
        const args = splitRawWords(q).slice(1).map(unquoteWord).join(" ");
        addPart(`${tail} ${args}`.trim(), depth + 1, out);
      }
    });
  });
}

/** Every string a deny or ask rule should be tried against for a whole command. */
export function commandCandidates(command: string): string[] {
  const out = new Set<string>([command]);
  addCommand(command, 0, out);
  return [...out];
}

/** The candidates for one part of a command. */
export function ruleCandidates(part: string): string[] {
  return commandCandidates(part);
}
