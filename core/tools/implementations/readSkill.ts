import { ToolImpl } from ".";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getStringArg } from "../parseArgs";

export const readSkillImpl: ToolImpl = async (args, extras) => {
  const skillName = getStringArg(args, "skillName");

  const skill = extras.config.skills.find((s) => s.name === skillName);

  if (!skill) {
    const availableSkills = extras.config.skills.map((s) => s.name).join(", ");
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
