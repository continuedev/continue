import { Skill, GetTool } from "../..";
import { loadMarkdownSkills } from "../../config/markdown/loadMarkdownSkills";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

function formatSkillEntry(skill: Skill): string {
  const lines = [
    `  <skill>`,
    `    <name>${skill.name}</name>`,
    `    <description>${skill.description}</description>`,
  ];
  if (skill.whenToUse) {
    lines.push(`    <when_to_use>${skill.whenToUse}</when_to_use>`);
  }
  lines.push(`  </skill>`);
  return lines.join("\n");
}

function buildDescription(skills: Skill[]): string {
  if (skills.length === 0) {
    return "Load a specialized skill that provides domain-specific instructions and workflows. No skills are currently available.";
  }

  const skillExamples = skills
    .slice(0, 3)
    .map((s) => `"${s.name}"`)
    .join(", ");

  return [
    "Load a specialized skill that provides domain-specific instructions, workflows, and access to bundled resources into the conversation context.",
    "",
    "When you recognize that a task matches one of the available skills below, invoke this tool to load the full skill instructions BEFORE generating any other response about the task.",
    "",
    "Important:",
    "- When a skill matches the user's request, this is a BLOCKING REQUIREMENT: invoke this tool BEFORE generating any other response about the task.",
    "- NEVER describe or summarize what a skill does without actually loading it first.",
    "- Do not invoke a skill that has already been loaded in the current conversation.",
    "",
    "<available_skills>",
    ...skills.map(formatSkillEntry),
    "</available_skills>",
    "",
    `Invoke with the skill name (e.g. ${skillExamples}).`,
  ].join("\n");
}

export const readSkillTool: GetTool = async (params) => {
  const { skills } = await loadMarkdownSkills(params.ide);
  return {
    type: "function",
    displayTitle: "Read Skill",
    wouldLikeTo: "load skill {{{ skillName }}}",
    isCurrently: "loading skill {{{ skillName }}}",
    hasAlready: "loaded skill {{{ skillName }}}",
    readonly: true,
    isInstant: true,
    group: BUILT_IN_GROUP_NAME,
    function: {
      name: BuiltInToolNames.ReadSkill,
      description: buildDescription(skills),
      parameters: {
        type: "object",
        required: ["skillName"],
        properties: {
          skillName: {
            type: "string",
            description: `The name of the skill from <available_skills> (e.g. ${skills.length > 0 ? skills.map((s) => `"${s.name}"`).join(", ") : "..."}).`,
          },
        },
      },
    },
  };
};
