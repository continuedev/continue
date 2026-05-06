import { ToolImpl } from ".";
import { loadMarkdownSkills } from "../../config/markdown/loadMarkdownSkills";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getStringArg } from "../parseArgs";

function normalizeSkillName(input: string): string {
  return input.trim().replace(/^\//, "");
}

function matchesSkillName(candidateName: string, requested: string): boolean {
  return (
    candidateName === requested ||
    candidateName.toLowerCase() === requested.toLowerCase()
  );
}

export const skillToolImpl: ToolImpl = async (args, extras) => {
  const rawSkill = getStringArg(args, "skill");
  const requestedSkill = normalizeSkillName(rawSkill);
  const providedArgs =
    typeof args?.args === "string" && args.args.trim().length > 0
      ? args.args.trim()
      : undefined;

  const { skills } = await loadMarkdownSkills(extras.ide);

  const skill = skills.find((candidate) =>
    matchesSkillName(candidate.name, requestedSkill),
  );

  if (!skill) {
    const availableSkills = skills.map((s) => s.name).join(", ");
    throw new ContinueError(
      ContinueErrorReason.SkillNotFound,
      `Skill "${requestedSkill}" not found. Available skills: ${availableSkills || "none"}`,
    );
  }

  let content = `You have loaded the skill "${skill.name}". Follow these instructions directly for the current task.\n\n# ${skill.name}\n\n${skill.content}`;

  if (skill.whenToUse) {
    content += `\n\n## When To Use\n${skill.whenToUse}`;
  }

  if (skill.argumentHint) {
    content += `\n\n## Argument Hint\n${skill.argumentHint}`;
  }

  if (skill.allowedTools && skill.allowedTools.length > 0) {
    content += `\n\n## Allowed Tools\n${skill.allowedTools.join(", ")}`;
  }

  if (skill.paths && skill.paths.length > 0) {
    content += `\n\n## Path Scope\n${skill.paths.join(", ")}`;
  }

  if (providedArgs) {
    content += `\n\n## Invocation Arguments\n${providedArgs}`;
  }

  if (skill.files.length > 0) {
    content += `\n\n## Supporting Files\nSkill directory contents:\n${skill.files.join("\n")}\n\nUse the read file tool to inspect any supporting files you need.`;
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
