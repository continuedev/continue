/**
 * Regression corpus for tool-permission rules (plans/tool-auto-approval.md, B4).
 *
 * Every entry comes from a published bypass or a vendor-documented limit.
 * Every case here is asserted to be caught; the cases that are NOT caught are
 * listed in knownGaps.vitest.ts, so a gap is visible and a fix flips a test.
 * Sources: GHSA-xq4m-mc3c-vvg3 / CVE-2025-66032 (Flatt Security write-up),
 * GHSA-66q4-vfjg-2qhh, GHSA-q728-gf8j-w49r, GHSA-mhg7-666j-cqg4,
 * GHSA-qgqw-h4xq-7w8w, GHSA-qxfv-fcpc-w36x, GHSA-x56v-x2h6-7j34 (all
 * anthropics/claude-code) and the "What a Bash rule doesn't match" table in
 * code.claude.com/docs/en/permissions.
 */

/** Each of these, but the first, runs `git push` in a way a plain text match can miss. */
export const GIT_PUSH_VARIANTS: [string, string][] = [
  ["control", "git push origin main"],
  ["absolute path", "/usr/bin/git push origin main"],
  ["exe suffix", "git.exe push origin main"],
  ["windows path", "C:\\Program Files\\Git\\bin\\git.exe push"],
  ["single-quoted subcommand", "git 'push' origin main"],
  ["double-quoted subcommand", 'git "push" origin main'],
  ["backslash in name", "g\\it push origin main"],
  ["empty quotes in name", 'gi""t push origin main'],
  ["quoted command name", '"git" push origin main'],
  ["ansi-c quoting", "$'git' push origin"],
  ["ansi-c hex", "$'\\x67it' push origin"],
  ["backslash in arg", "git pu\\sh origin"],
  ["git -C", "git -C . push origin main"],
  ["git -c", "git -c push.default=current push"],
  ["git --no-pager", "git --no-pager push"],
  ["upper case", "GIT push origin main"],
  ["command builtin", "command git push"],
  ["timeout wrapper", "timeout 30 git push"],
  ["nohup wrapper", "nohup git push"],
  ["env wrapper", "env -i git push"],
  ["env assignment", "FOO=1 git push"],
  ["eval single", "eval 'git push'"],
  ["eval double", 'eval "git push"'],
  ["bash -c single", "bash -c 'git push'"],
  ["bash -c double", 'bash -c "git push"'],
  ["sh -c escaped space", "sh -c git\\ push"],
  ["powershell -Command", 'powershell -Command "git push"'],
  ["pwsh -c", "pwsh -c 'git push'"],
  ["cmd /c", "cmd /c git push"],
  ["call operator", "& git push"],
  ["subshell", "(git push)"],
  ["brace group", "{ git push; }"],
  ["if body", "if true; then git push; fi"],
  ["for body", "for i in 1; do git push; done"],
  ["variable subcommand", "X=push; git $X origin"],
  ["variable holding the command", "G=git; $G push"],
  ["variable built from parts", "a=gi; b=t; $a$b push"],
  ["function body", "f() { git push; }; f"],
  ["xargs", "echo push | xargs git"],
  ["python -c", "python -c \"import os; os.system('git push')\""],
  ["node -e", "node -e \"require('child_process').execSync('git push')\""],
  ["find -exec", "find . -maxdepth 0 -exec git push \\;"],
  ["tab separator", "git\tpush origin"],
  ["line continuation", "git\\\npush origin"],
  ["command substitution", "echo $(git push)"],
  ["backticks", "echo `git push`"],
  ["here-string into sh", "sh <<< 'git push'"],
  ["pipe into sh", "echo 'git push' | sh"],
];
