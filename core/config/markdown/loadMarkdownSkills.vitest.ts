import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { IDE } from "../..";
import { localPathToUri } from "../../util/pathToUri";
import { getGlobalFolderWithName } from "../../util/paths";
import { readSkillImpl } from "../../tools/implementations/readSkill";
import { readSkillTool } from "../../tools/definitions/readSkill";
import { isSkillFileUri, loadMarkdownSkills } from "./loadMarkdownSkills";

function fixture(files: Record<string, string>) {
  const dirs = new Map<string, Map<string, number>>();
  for (const file of Object.keys(files)) {
    const parts = file.split("/");
    for (let i = 3; i < parts.length; i++) {
      const parent = parts.slice(0, i).join("/");
      if (!dirs.has(parent)) dirs.set(parent, new Map());
      dirs.get(parent)!.set(parts[i], i === parts.length - 1 ? 1 : 2);
    }
  }
  return {
    getWorkspaceDirs: vi.fn(async () => ["file:///workspace"]),
    fileExists: vi.fn(async (uri: string) => dirs.has(uri) || uri in files),
    readFile: vi.fn(async (uri: string) => files[uri]),
    listDir: vi.fn(async (uri: string) => [
      ...(dirs.get(uri)?.entries() ?? []),
    ]),
  } as unknown as IDE;
}
const skill = (name: string, body = "Use this instruction") =>
  `---\nname: ${name}\ndescription: Use for testing skills\n---\n${body}`;

describe("SKILL.md integration", () => {
  it("discovers all project and user roots with deterministic workspace precedence", async () => {
    const ide = fixture({
      "file:///workspace/.agents/skills/review/SKILL.md": skill(
        "review",
        "workspace",
      ),
      "file:///workspace/.claude/skills/claude/SKILL.md": skill("claude"),
      "file:///workspace/.codex/skills/codex/SKILL.md": skill("codex"),
      "file:///workspace/.continue/skills/native/SKILL.md": skill("native"),
      [`${localPathToUri(getGlobalFolderWithName("skills"))}/review/SKILL.md`]:
        skill("review", "global"),
      [`${localPathToUri(path.join(os.homedir(), ".claude/skills"))}/global/SKILL.md`]:
        skill("global"),
    });
    const { skills, errors } = await loadMarkdownSkills(ide);
    expect(skills.map((s) => s.name)).toEqual([
      "native",
      "review",
      "claude",
      "codex",
      "global",
    ]);
    expect(skills.find((s) => s.name === "review")?.content).toBe("workspace");
    expect(errors[0].message).toContain("shadowed");
    expect(skills[0].path).toBe(
      "file:///workspace/.continue/skills/native/SKILL.md",
    );
  });

  it("requires exact filename and valid leading frontmatter; isolates malformed skills", async () => {
    const ide = fixture({
      "file:///workspace/.agents/skills/good/SKILL.md": skill("good"),
      "file:///workspace/.agents/skills/ignored/NOT-SKILL.md": skill("ignored"),
      "file:///workspace/.agents/skills/bad/SKILL.md": skill("wrong-directory"),
      "file:///workspace/.agents/skills/invalid/SKILL.md":
        "---\nname: [broken\n---\nBody",
      "file:///workspace/.agents/skills/late/SKILL.md": `Not frontmatter\n${skill("late")}`,
    });
    const { skills, errors } = await loadMarkdownSkills(ide);
    expect(skills.map((s) => s.name)).toEqual(["good"]);
    expect(errors).toHaveLength(3);
  });

  it("advertises metadata only, then reads the selected body and resource paths", async () => {
    const base = "file:///workspace/.agents/skills/review";
    const ide = fixture({
      [`${base}/SKILL.md`]: skill("review", "SECRET BODY"),
      [`${base}/references/guide.md`]: "REFERENCE BODY",
    });
    const tool = await readSkillTool({ ide } as any);
    expect(tool.function.description).toContain("review");
    expect(tool.function.description).not.toContain("SECRET BODY");
    expect(ide.listDir).not.toHaveBeenCalledWith(`${base}/references`);
    const result = await readSkillImpl({ skillName: "review" }, { ide } as any);
    expect(result[0].content).toContain("SECRET BODY");
    expect(result[0].content).toContain(`Base directory: ${base}`);
    expect(result[0].content).toContain(`${base}/references/guide.md`);
    expect(result[0].content).not.toContain("REFERENCE BODY");
    expect(ide.readFile).not.toHaveBeenCalledWith(
      `${base}/references/guide.md`,
    );
    await expect(
      readSkillImpl({ skillName: "unknown" }, { ide } as any),
    ).rejects.toThrow('Skill "unknown" not found');
  });

  it("only inventories supporting resources for the activated skill", async () => {
    const base = "file:///workspace/.agents/skills";
    const ide = fixture({
      [`${base}/chosen/SKILL.md`]: skill("chosen"),
      [`${base}/other/SKILL.md`]: skill("other"),
      [`${base}/other/references/guide.md`]: "Not needed",
    });
    await readSkillImpl({ skillName: "chosen" }, { ide } as any);
    expect(ide.listDir).not.toHaveBeenCalledWith(`${base}/other/references`);
  });

  it("accepts optional metadata and CRLF without granting permissions", async () => {
    const text =
      "---\nname: example\ndescription: An example\ncompatibility: Needs git\nlicense: MIT\nmetadata:\n  author: someone\nallowed-tools: Bash\n---\nInstructions";
    const { skills } = await loadMarkdownSkills(
      fixture({
        "file:///workspace/.agents/skills/example/SKILL.md": text.replace(
          /\n/g,
          "\r\n",
        ),
      }),
    );
    expect(skills[0]).toMatchObject({
      compatibility: "Needs git",
      license: "MIT",
      "allowed-tools": "Bash",
      metadata: { author: "someone" },
    });
  });

  it("continues after a root is unreadable", async () => {
    const ide = fixture({
      "file:///workspace/.agents/skills/example/SKILL.md": skill("example"),
    });
    const original = ide.fileExists;
    ide.fileExists = async (uri) => {
      if (uri === "file:///workspace/.continue/skills")
        throw new Error("denied");
      return original(uri);
    };
    const result = await loadMarkdownSkills(ide);
    expect(result.skills).toHaveLength(1);
    expect(result.errors[0].message).toContain("denied");
  });

  it("loads symlinked skill directories and bounds recursive links", async () => {
    const base = "file:///workspace/.agents/skills";
    const ide = fixture({ [`${base}/linked/SKILL.md`]: skill("linked") });
    const original = ide.listDir;
    ide.listDir = vi.fn(async (uri: string) => {
      if (uri === base)
        return [
          ["linked", 66],
          ["loop", 66],
        ] as any;
      if (uri.startsWith(`${base}/loop`)) return [["loop", 66]] as any;
      return original(uri);
    });
    const { skills, errors } = await loadMarkdownSkills(ide, false);
    expect(skills.map((s) => s.name)).toEqual(["linked"]);
    expect(
      errors.some((error) => error.message.includes("limit reached")),
    ).toBe(true);
    expect(ide.listDir).toHaveBeenCalledTimes(8);
  });

  it("preserves remote workspace URIs", async () => {
    const root = "vscode-remote://ssh-remote+host/project";
    const uri = `${root}/.agents/skills/remote/SKILL.md`;
    const ide = fixture({ [uri]: skill("remote") });
    ide.getWorkspaceDirs = async () => [root];
    const { skills } = await loadMarkdownSkills(ide);
    expect(skills[0].path).toBe(uri);
  });

  it("reports unavailable workspaces without breaking configuration", async () => {
    const ide = fixture({});
    ide.getWorkspaceDirs = async () => {
      throw new Error("remote disconnected");
    };
    const { skills, errors } = await loadMarkdownSkills(ide);
    expect(skills).toEqual([]);
    expect(errors[0]).toMatchObject({
      fatal: false,
      message: expect.stringContaining("remote disconnected"),
    });
  });

  it("keeps a valid skill when a supporting resource directory is unreadable", async () => {
    const base = "file:///workspace/.agents/skills/example";
    const ide = fixture({
      [`${base}/SKILL.md`]: skill("example"),
      [`${base}/references/file.md`]: "text",
    });
    const original = ide.listDir;
    ide.listDir = async (uri) => {
      if (uri.endsWith("/references")) throw new Error("denied");
      return original(uri);
    };
    const { skills, errors } = await loadMarkdownSkills(ide);
    expect(skills[0].content).toBe("Use this instruction");
    expect(errors[0].message).toContain("Cannot list supporting resources");
  });

  it("lets project and user skills override bundled defaults", async () => {
    const bundled = "file:///installed-extension/bundled-skills";
    const global = localPathToUri(getGlobalFolderWithName("skills"));
    const ide = fixture({
      "file:///workspace/.agents/skills/review/SKILL.md": skill(
        "review",
        "project",
      ),
      [`${global}/personal/SKILL.md`]: skill("personal", "personal"),
      [`${bundled}/review/SKILL.md`]: skill("review", "bundle"),
      [`${bundled}/personal/SKILL.md`]: skill("personal", "bundle"),
      [`${bundled}/default/SKILL.md`]: skill("default", "bundle"),
    });
    ide.getBundledSkillsDir = async () => bundled;
    const { skills } = await loadMarkdownSkills(ide, false);
    expect(skills.map(({ name, content }) => [name, content])).toEqual([
      ["review", "project"],
      ["personal", "personal"],
      ["default", "bundle"],
    ]);
  });

  it("recognizes skill changes for config reload", () => {
    expect(
      isSkillFileUri("file:///workspace/.agents/skills/example/SKILL.md"),
    ).toBe(true);
    expect(
      isSkillFileUri("file:///workspace/.claude/skills/example/SKILL.md"),
    ).toBe(true);
    expect(
      isSkillFileUri("file:///workspace/.agents/skills/example/NOT-SKILL.md"),
    ).toBe(false);
  });
});
