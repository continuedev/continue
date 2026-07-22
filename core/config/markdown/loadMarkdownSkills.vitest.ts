import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadMarkdownSkills } from "./loadMarkdownSkills";
import { readSkillImpl } from "../../tools/implementations/readSkill";
import { testIde } from "../../test/fixtures";
import {
  setUpTestDir,
  tearDownTestDir,
  TEST_DIR_PATH,
} from "../../test/testDir";

function createDirectorySymlink(target: string, linkPath: string) {
  fs.symlinkSync(
    target,
    linkPath,
    process.platform === "win32" ? "junction" : "dir",
  );
}

describe("loadMarkdownSkills", () => {
  beforeEach(() => {
    setUpTestDir();
  });

  afterEach(() => {
    tearDownTestDir();
  });

  it("loads symlinked project skills and makes them readable through read_skill", async () => {
    const targetSkillDir = path.join(TEST_DIR_PATH, "shared-skill-target");
    fs.mkdirSync(targetSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetSkillDir, "SKILL.md"),
      `---
name: Skill Creator
description: Creates skills
---

# Skill Creator
`,
    );
    fs.writeFileSync(
      path.join(targetSkillDir, "helper.ts"),
      "// helper code\n",
    );

    const skillsDir = path.join(TEST_DIR_PATH, ".continue", "skills");
    fs.mkdirSync(skillsDir, { recursive: true });
    createDirectorySymlink(
      targetSkillDir,
      path.join(skillsDir, "skill-creator"),
    );

    const result = await loadMarkdownSkills(testIde);

    expect(result.errors).toEqual([]);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe("Skill Creator");
    expect(result.skills[0].path).toBe(
      ".continue/skills/skill-creator/SKILL.md",
    );
    expect(
      result.skills[0].files.some((file) => file.endsWith("helper.ts")),
    ).toBe(true);

    const readResult = await readSkillImpl({ skillName: "Skill Creator" }, {
      ide: testIde,
    } as any);

    expect(readResult[0]?.name).toBe("Skill: Skill Creator");
    expect(readResult[0]?.content).toContain("# Skill Creator");
    expect(readResult[0]?.content).toContain("helper.ts");
  });
});
