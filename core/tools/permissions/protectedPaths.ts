/**
 * The lists behind protected paths (see protected.ts). Pure data and predicates,
 * all on paths already normalised by `normalizeProtectedPath` (forward slashes,
 * `~` for the home directory, `..` resolved). Sources: Claude Code's published
 * protected-directory list (code.claude.com/docs/en/permission-modes), the
 * advisories that bypassed it, and the credential files the common CLIs create.
 */

/** `~/<dir>` holds credentials: the directory and everything under it. */
export const HOME_SECRET_DIRS = new Set([
  ".ssh",
  ".aws",
  ".gnupg",
  ".kube",
  ".azure",
  ".docker",
  ".terraform.d",
  ".oci",
  ".config/gh",
  ".config/gcloud",
  ".config/doctl",
  ".config/hub",
]);

/** Home files that are themselves credentials. */
const HOME_SECRET_FILES = new Set([
  ".git-credentials",
  ".pgpass",
  ".my.cnf",
  ".netrc",
  ".npmrc",
  ".pypirc",
  ".s3cfg",
  ".boto",
  ".dockercfg",
  ".vault-token",
  ".yarnrc.yml",
  ".gem/credentials",
]);

/** File names that are credentials wherever they sit. */
const SECRET_BASENAMES = new Set([
  ".netrc",
  ".npmrc",
  ".pypirc",
  ".git-credentials",
  ".pgpass",
  ".htpasswd",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "credentials.json",
  "service-account.json",
  "terraform.tfstate",
  "terraform.tfstate.backup",
  "terraform.tfvars",
  "secrets.yaml",
  "secrets.yml",
  "secrets.json",
  "secret.yaml",
  "secret.yml",
]);

const SECRET_EXTENSIONS = new Set([
  ".pem",
  ".key",
  ".pfx",
  ".p12",
  ".jks",
  ".keystore",
  ".ppk",
  ".kdbx",
  ".tfvars",
  ".tfstate",
]);

/** Absolute system locations that hold credentials or secrets. */
const SYSTEM_SECRET = [
  /^\/etc\/(shadow|gshadow|sudoers|ssh\/ssh_host_[a-z0-9_]+_key)$/,
  /^\/etc\/sudoers\.d(\/|$)/,
  /^\/proc\/(self|\d+)\/(environ|mem|maps)$/,
  /^\/(var\/)?root\/\.(ssh|aws|gnupg)(\/|$)/,
  /^\/home\/[^/]+\/\.(ssh|aws|gnupg|kube|azure|docker)(\/|$)/,
  /^\/users\/[^/]+\/\.(ssh|aws|gnupg|kube|azure|docker)(\/|$)/i,
  /^[a-z]:\/users\/[^/]+\/\.(ssh|aws|gnupg|kube|azure|docker)(\/|$)/i,
];

const ENV_TEMPLATE = /\.(example|sample|template|dist|defaults)$/i;

/** True for `.env`, `.env.local`, `prod.env`; false for `.env.example` and `.environment`. */
function isEnvFile(base: string): boolean {
  if (ENV_TEMPLATE.test(base)) return false;
  return /^\.env(\..+)?$/.test(base) || /^[^/]+\.env$/.test(base);
}

export function isSecretPath(p: string): boolean {
  const segs = p.split("/").filter((s) => s !== "" && s !== ".");
  if (segs.length === 0) return false;
  const base = segs[segs.length - 1].toLowerCase();
  if (isEnvFile(base)) return true;
  if (SECRET_BASENAMES.has(base)) return true;
  const dot = base.lastIndexOf(".");
  if (dot > 0 && SECRET_EXTENSIONS.has(base.slice(dot))) return true;
  if (SYSTEM_SECRET.some((re) => re.test(p))) return true;
  if (segs[0] !== "~" || segs.length < 2) return false;
  const rest = segs.slice(1).map((s) => s.toLowerCase());
  if (HOME_SECRET_FILES.has(rest.join("/"))) return true;
  for (const dir of HOME_SECRET_DIRS) {
    const d = dir.split("/");
    if (d.every((part, i) => rest[i] === part)) return true;
  }
  return false;
}

/** Directories whose contents change what runs later, or configure a tool. */
const CONFIG_DIRS = new Set([
  ".git",
  ".continuous",
  ".continue",
  ".vscode",
  ".idea",
  ".husky",
  ".cargo",
  ".devcontainer",
  ".yarn",
  ".mvn",
  ".claude",
  ".cursor",
  ".windsurf",
  ".cline",
  ".aider",
  ".gemini",
  ".codex",
  ".roo",
]);

/** Directory pairs, for locations that sit under a shared parent. */
const CONFIG_DIR_PAIRS: [string, string][] = [
  [".github", "workflows"],
  [".github", "actions"],
  [".config", "git"],
  [".config", "fish"],
  [".config", "systemd"],
  ["library", "launchagents"],
  ["library", "launchdaemons"],
  [".local", "share/applications"],
];

/**
 * Files that make something run, or configure a tool that runs things, wherever they
 * sit. Deliberately NOT here: agent instruction files (AGENTS.md, CLAUDE.md,
 * .clinerules, copilot-instructions.md), which people edit constantly, and
 * .gitattributes / .gitmodules, which cannot run code on their own. A rule can
 * add any of them: writeFile(AGENTS.md) in toolPermissions.ask.
 */
const CONFIG_BASENAMES = new Set([
  ".continuousrc.json",
  ".continuousrc.yaml",
  ".continuousrc.yml",
  ".continuerc.json",
  ".continuerc.yaml",
  ".continuerc.yml",
  ".mcp.json",
  ".envrc",
  ".pre-commit-config.yaml",
  ".gitlab-ci.yml",
  "jenkinsfile",
  ".bashrc",
  ".bash_profile",
  ".bash_login",
  ".bash_logout",
  ".profile",
  ".zshrc",
  ".zshenv",
  ".zprofile",
  ".zlogin",
  ".gitconfig",
  ".inputrc",
  "config.fish",
]);

export function isConfigPath(p: string): boolean {
  const segs = p.split("/").filter((s) => s !== "" && s !== ".");
  const low = segs.map((s) => s.toLowerCase());
  if (low.some((s) => CONFIG_DIRS.has(s))) return true;
  for (let i = 0; i + 1 < low.length; i++) {
    for (const [a, b] of CONFIG_DIR_PAIRS) {
      if (
        low[i] === a &&
        (low[i + 1] === b ||
          low
            .slice(i + 1)
            .join("/")
            .startsWith(b))
      ) {
        return true;
      }
    }
  }
  const base = low[low.length - 1];
  return base !== undefined && CONFIG_BASENAMES.has(base);
}
