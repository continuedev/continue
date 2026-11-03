import { describe, expect, it } from "vitest";
import { protectedCommandHit } from "../protectedCall";
import { decideToolCall } from "../decide";
import { parseToolPermissions } from "../rules";

const HOME = "C:\\Users\\me";

/**
 * Everyday commands that must NOT be held up by the protected-path or secret
 * checks. If one of these starts asking, the hardening is too broad and
 * people will learn to click through prompts, which is worse than no prompt.
 */
const ORDINARY: string[] = [
  "ls",
  "ls -la",
  "pwd",
  "cd src",
  "cd ..",
  "git status",
  "git diff",
  "git log --oneline -5",
  "git add .",
  "git commit -m 'fix: handle empty input'",
  "git checkout -b feature/x",
  "git pull",
  "git fetch origin",
  "git stash",
  "git branch -a",
  "npm install",
  "npm ci",
  "npm test",
  "npm run build",
  "npm run lint",
  "npx tsc --noEmit",
  "yarn install",
  "pnpm i",
  "node scripts/build.js",
  "node --version",
  "python script.py",
  "python -m pytest -q",
  "pip install -r requirements.txt",
  "cargo build",
  "cargo test",
  "go test ./...",
  "go build ./...",
  "make",
  "make test",
  "dotnet build",
  "mvn test",
  "gradle build",
  "cat README.md",
  "cat package.json",
  "head -n 20 src/index.ts",
  "tail -f logs/app.log",
  "grep -rn TODO src",
  "grep -r 'api key' docs",
  "rg 'password' src/auth",
  "find . -name '*.ts' -not -path './node_modules/*'",
  "wc -l src/**/*.ts",
  "diff a.txt b.txt",
  "echo hello",
  "echo $HOME",
  "echo $PATH",
  "echo $USER",
  "echo $NODE_ENV",
  'echo "build done"',
  "printf '%s\\n' hi",
  "which node",
  "node -p 1+1",
  "docker ps",
  "docker build -t app .",
  "docker compose up -d",
  "mkdir -p build/out",
  "cp a.txt b.txt",
  "mv old.ts new.ts",
  "rm build/tmp.txt",
  "touch notes.md",
  "tsc -p tsconfig.json",
  "eslint src --fix",
  "prettier --write src",
  "vitest run",
  "curl -s https://api.github.com/repos/o/r",
  "ping -c 1 localhost",
  "date",
  "uname -a",
  "whoami",
  "cat src/keyboard.ts",
  "cat src/tokenizer.ts",
  "cat docs/passwords-policy.md",
  "cat docs/secrets-management.md",
  "ls src/auth",
  "grep -n secret src/config.ts",
  "cat src/environment.ts",
  "cat .gitignore",
  "cat .editorconfig",
  "cat tsconfig.json",
  "terraform fmt",
  "terraform validate",
  "terraform plan",
  "tofu init -backend=false",
  "echo $KEYBOARD_LAYOUT",
  "echo $MONKEY",
  "echo ${HOME}/bin",
  "cd C:\\github\\proj && npm test",
  "dir",
  "type README.md",
  "Get-ChildItem src",
  "Get-Content package.json",
  "Select-String TODO src\\*.ts",
  "echo 50%",
  "echo 100% done",
  "git log --author='a@b.com'",
  "git config user.name",
  "git remote -v",
  "git tag v1.0.0",
];

describe("ordinary commands are not held up by the secret and path checks", () => {
  it.each(ORDINARY)("%s", (command) => {
    expect(protectedCommandHit(command, HOME)).toBeUndefined();
  });

  it("measures the false-positive rate (informational, must stay at zero)", () => {
    const hits = ORDINARY.filter(
      (c) => protectedCommandHit(c, HOME) !== undefined,
    );
    expect(hits).toEqual([]);
  });
});

describe("a deny rule on one command does not refuse its neighbours", () => {
  const rules = parseToolPermissions({
    deny: ["runTerminalCommand(git push*)"],
  });
  const refused = (command: string) =>
    decideToolCall({
      toolName: "run_terminal_command",
      parsedArgs: { command },
      base: "allowedWithoutPermission",
      evaluated: "allowedWithoutPermission",
      rules,
    }).policy === "disabled";

  it.each([
    "git pull",
    "git status",
    "git fetch",
    "git log",
    "git commit -m 'push it'",
    "git checkout push-notifications",
    "git branch -d pusher",
    "echo pushed",
    "git config alias.p push",
    "gitk",
    "github-cli status",
    "git-lfs pull",
    "git pull --rebase",
    "git --version",
    "git diff HEAD~1",
  ])("%s runs", (command) => {
    expect(refused(command)).toBe(false);
  });

  it.each([
    "git push",
    "git push origin main",
    "git push --force-with-lease",
    "GIT PUSH",
    "git -C ../other push",
    "sudo git push",
    "git 'push'",
  ])("%s is refused", (command) => {
    expect(refused(command)).toBe(true);
  });
});
