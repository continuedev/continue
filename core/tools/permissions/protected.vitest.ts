import { describe, expect, it } from "vitest";
import {
  normalizeProtectedPath,
  protectedPathHit,
  protectedReason,
} from "./protected";

const HOME = "C:\\Users\\me";
const hit = (
  p: string,
  kinds: ("secret" | "config")[] = ["secret", "config"],
) => protectedPathHit(p, kinds, HOME)?.kind;

describe("normalizeProtectedPath", () => {
  it("uses ~ for the home directory in every spelling", () => {
    expect(
      normalizeProtectedPath("C:\\Users\\me\\.aws\\credentials", HOME),
    ).toBe("~/.aws/credentials");
    expect(normalizeProtectedPath("c:/users/ME/.ssh/id_rsa", HOME)).toBe(
      "~/.ssh/id_rsa",
    );
    expect(normalizeProtectedPath("$HOME/.ssh", HOME)).toBe("~/.ssh");
    expect(normalizeProtectedPath("%USERPROFILE%\\.aws", HOME)).toBe("~/.aws");
    expect(normalizeProtectedPath("~/.aws", HOME)).toBe("~/.aws");
  });

  it("resolves . and .. and slashes", () => {
    expect(normalizeProtectedPath("./a/../.env", HOME)).toBe(".env");
    expect(normalizeProtectedPath("src\\..\\.env", HOME)).toBe(".env");
  });

  it("treats a file URI's /C:/ path like a drive path", () => {
    expect(normalizeProtectedPath("/C:/Users/me/.aws/credentials", HOME)).toBe(
      "~/.aws/credentials",
    );
    expect(hit("/C:/Users/me/.ssh/id_rsa")).toBe("secret");
  });

  it("does not treat another user's home as ours", () => {
    expect(normalizeProtectedPath("C:\\Users\\meagan\\x", HOME)).toBe(
      "C:/Users/meagan/x",
    );
  });
});

describe("secret paths", () => {
  it.each([
    ".env",
    "app/.env",
    "app/.ENV",
    ".env.local",
    ".env.production",
    "~/.ssh",
    "~/.ssh/id_rsa",
    "~/.aws/credentials",
    "C:\\Users\\me\\.aws\\config",
    "~/.kube/config",
    "~/.gnupg/secring.gpg",
    ".npmrc",
    "deploy/.netrc",
    "keys/id_ed25519",
  ])("%s is secret", (p) => {
    expect(hit(p)).toBe("secret");
  });

  it.each([
    ".env.example",
    ".env.sample",
    "config/.env.template",
    ".environment",
    "env.ts",
    "src/dotenv.ts",
    ".sshconfig-notes.md",
    "docs/ssh.md",
    "other/.ssh/x",
  ])("%s is not", (p) => {
    expect(hit(p)).toBeUndefined();
  });

  it("applies when only the secret list is asked for", () => {
    expect(hit(".env", ["secret"])).toBe("secret");
    expect(hit(".env", ["config"])).toBeUndefined();
  });
});

describe("config paths", () => {
  it.each([
    ".git/config",
    ".git/hooks/pre-commit",
    "sub/.git/HEAD",
    ".GIT/config",
    ".continuous/config.yaml",
    ".vscode/tasks.json",
    ".github/workflows/ci.yml",
    "repo/.GitHub/Workflows/x.yml",
    "~/.bashrc",
    "~/.zshrc",
    ".profile",
  ])("%s is config", (p) => {
    expect(hit(p)).toBe("config");
  });

  it.each([
    ".github/CODEOWNERS",
    ".github/dependabot.yml",
    ".gitignore",
    ".gitattributes",
    "src/git.ts",
    "docs/.vscode-notes.md",
  ])("%s is not", (p) => {
    expect(hit(p)).toBeUndefined();
  });

  it("is ignored when only the secret list is asked for (plain reads)", () => {
    expect(hit(".git/config", ["secret"])).toBeUndefined();
  });

  it("secret wins when a path is both", () => {
    expect(hit(".git/.env")).toBe("secret");
  });
});

describe("protectedReason", () => {
  it("names the path and why", () => {
    expect(
      protectedReason({ kind: "secret", path: "~/.aws/credentials" }),
    ).toMatch(/~\/\.aws\/credentials.*credentials/);
    expect(protectedReason({ kind: "config", path: ".git/hooks/x" })).toMatch(
      /change what runs later/,
    );
  });
});

describe("empty input", () => {
  it("is not protected", () => {
    expect(protectedPathHit(undefined, ["secret"], HOME)).toBeUndefined();
    expect(protectedPathHit("", ["secret"], HOME)).toBeUndefined();
    expect(protectedPathHit("   ", ["secret"], HOME)).toBeUndefined();
  });
});
