import { ToolImpl } from ".";
import { loadMarkdownSkills } from "../../config/markdown/loadMarkdownSkills";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getStringArg } from "../parseArgs";

export const readSkillImpl: ToolImpl = async (args, extras) => {
  const skillName = getStringArg(args, "skillName");

  const { skills } = await loadMarkdownSkills(extras.ide, true, skillName);

  const skill = skills.find((s) => s.name === skillName);

  if (!skill) {
    const availableSkills = skills.map((s) => s.name).join(", ");
    throw new ContinueError(
      ContinueErrorReason.SkillNotFound,
      `Skill "${skillName}" not found. Available skills: ${availableSkills || "none"}`,
    );
  }

  let content = `Skill: ${skill.name}\nBase directory: ${skill.path.slice(0, skill.path.lastIndexOf("/"))}\nResolve relative resource and script paths against this directory. Script execution uses the normal terminal tool and approval policy. References to a Skill tool mean read_skill here. Use only tools actually provided by this IDE; if a skill requires an unavailable tool, explain the limitation instead of inventing a tool call.\n\n${skill.content}`;

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
