import { ToolImpl } from ".";
import { loadMarkdownSkills } from "../../config/markdown/loadMarkdownSkills";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getStringArg } from "../parseArgs";

export const readSkillImpl: ToolImpl = async (args, extras) => {
  const skillName = getStringArg(args, "skillName").trim().replace(/^\//, "");

  const { skills } = await loadMarkdownSkills(extras.ide);

  const skill = skills.find(
    (s) =>
      s.name === skillName || s.name.toLowerCase() === skillName.toLowerCase(),
  );

  if (!skill) {
    const availableSkills = skills.map((s) => s.name).join(", ");
    throw new ContinueError(
      ContinueErrorReason.SkillNotFound,
      `Skill "${skillName}" not found. Available skills: ${availableSkills || "none"}`,
    );
  }

  let content = skill.content;

  if (skill.whenToUse) {
    content += `\n
## When to use
${skill.whenToUse}`;
  }

  if (skill.argumentHint) {
    content += `\n
## Argument hint
${skill.argumentHint}`;
  }

  if (skill.allowedTools && skill.allowedTools.length > 0) {
    content += `\n
## Allowed tools
${skill.allowedTools.join(", ")}`;
  }

  if (skill.files.length > 0) {
    content += `\n
## Supporting files
Skill directory:
${skill.files.join("\n")}

Use the read file tool to access these files as needed.`;
  }

  return [
    {
      name: `Skill: ${skill.name}`,
      description: skill.description,
      content,
      uri: {
        type: "file",
        value: skill.path,
      },
    },
  ];
};
