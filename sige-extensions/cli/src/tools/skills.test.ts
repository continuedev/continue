import { ContinueError, ContinueErrorReason } from "core/util/errors.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Skill } from "../util/loadMarkdownSkills.js";

import { skillsTool } from "./skills.js";

vi.mock("../util/loadMarkdownSkills.js");
vi.mock("../util/logger.js");

const mockSkills: Skill[] = [
  {
    name: "test-skill",
    description: "A test skill",
    path: "/path/to/skill",
    content: "Skill content here",
    files: [],
  },
  {
    name: "skill-with-files",
    description: "Skill with extra files",
    path: "/path/to/skill2",
    content: "Another skill",
    files: ["/path/to/file1.ts", "/path/to/file2.ts"],
  },
];

describe("skillsTool", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { loadMarkdownSkills } = await import(
      "../util/loadMarkdownSkills.js"
    );
    vi.mocked(loadMarkdownSkills).mockResolvedValue({
      skills: mockSkills,
      errors: [],
    });
  });

  it("should include skill names in description", async () => {
    const tool = await skillsTool();
    expect(tool.description).toContain("test-skill");
    expect(tool.description).toContain("skill-with-files");
  });

  describe("preprocess", () => {
    it("should return preview with skill name", async () => {
      const tool = await skillsTool();
      const result = await tool.preprocess!({ skill_name: "test-skill" });
      expect(result.preview).toEqual([
        { type: "text", content: "Reading skill: test-skill" },
      ]);
    });
  });

  describe("run", () => {
    it("should return skill content when found", async () => {
      const tool = await skillsTool();
      const result = await tool.run({ skill_name: "test-skill" });
      expect(result).toContain("<skill_name>test-skill</skill_name>");
      expect(result).toContain(
        "<skill_description>A test skill</skill_description>",
      );
      expect(result).toContain(
        "<skill_content>Skill content here</skill_content>",
      );
    });

    it("should include files when skill has files", async () => {
      const tool = await skillsTool();
      const result = await tool.run({ skill_name: "skill-with-files" });
      expect(result).toContain("<skill_files>");
      expect(result).toContain("/path/to/file1.ts");
      expect(result).toContain("<other_instructions>");
    });

    it("should throw ContinueError when skill not found", async () => {
      const tool = await skillsTool();
      const error = await tool
        .run({ skill_name: "nonexistent" })
        .catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(ContinueErrorReason.SkillNotFound);
      expect(error.message).toContain("nonexistent");
    });
  });
});
