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

  return [
    {
      name: `Skill: ${skill.name}`,
      description: skill.description,
      content: `# ${skill.name}\n\n${skill.description}\n\n## Instructions\n\n${skill.content}`,
      uri: {
        type: "file",
        value: skill.path,
      },
    },
  ];
};
