import { ToolImpl } from ".";
import { loadMarkdownSkills } from "../../config/markdown/loadMarkdownSkills";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getStringArg } from "../parseArgs";

export const readSkillImpl: ToolImpl = async (args, extras) => {
  const skillName = getStringArg(args, "skillName");

  const { skills } = await loadMarkdownSkills(extras.ide);

  const skill = skills.find((s) => s.name === skillName);

  if (!skill) {
    const availableSkills = skills.map((s) => s.name).join(", ");
    throw new ContinueError(
      ContinueErrorReason.SkillNotFound,
      `Skill "${skillName}" not found. Available skills: ${availableSkills || "none"}`,
    );
  }

  const contentParts = [
    `<skill name="${skill.name}">`,
    `# Skill: ${skill.name}`,
    "",
    skill.content.trim(),
  ];

  if (skill.files.length > 0) {
    const skillDir = skill.path.substring(0, skill.path.lastIndexOf("/"));
    contentParts.push("");
    contentParts.push(`Skill directory: ${skillDir}`);
    contentParts.push(
      "Relative paths in this skill are relative to the skill directory above.",
    );
    contentParts.push("");
    contentParts.push("<skill_files>");
    contentParts.push(...skill.files);
    contentParts.push("</skill_files>");
    contentParts.push("");
    contentParts.push(
      "Use the read file tool to access these supporting files as needed.",
    );
  }

  contentParts.push("</skill>");
  contentParts.push("");
  contentParts.push(
    "Follow the instructions in the loaded skill above. The skill is now active for this conversation.",
  );

  return [
    {
      name: `Skill: ${skill.name}`,
      description: skill.description,
      content: contentParts.join("\n"),
      uri: {
        type: "file",
        value: skill.path,
      },
    },
  ];
};
