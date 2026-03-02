import { ContinueError, ContinueErrorReason } from "core/util/errors.js";

import {
  loadMarkdownSkills,
  type Skill,
} from "../util/loadMarkdownSkills.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

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

export const SKILLS_TOOL_META: Tool = {
  name: "Skills",
  displayName: "Skills",
  description:
    "Load a specialized skill that provides domain-specific instructions and workflows. No skills are currently available.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["skill_name"],
    properties: {
      skill_name: {
        type: "string",
        description: "The name of the skill from <available_skills>.",
      },
    },
  },
  run: async () => "",
};

export const skillsTool = async (): Promise<Tool> => {
  const { skills } = await loadMarkdownSkills();

  return {
    ...SKILLS_TOOL_META,

    description: buildDescription(skills),

    parameters: {
      type: "object",
      required: ["skill_name"],
      properties: {
        skill_name: {
          type: "string",
          description: `The name of the skill from <available_skills> (e.g. ${skills.length > 0 ? skills.map((s) => `"${s.name}"`).join(", ") : "..."}).`,
        },
      },
    },

    preprocess: async (args: any) => {
      const { skill_name } = args;

      return {
        args,
        preview: [
          {
            type: "text",
            content: `Loading skill: ${skill_name}`,
          },
        ],
      };
    },

    run: async (args: any, context?: { toolCallId: string }) => {
      const { skill_name } = args;

      logger.debug("skill args", { args, context });

      const skill = skills.find((s) => s.name === skill_name);
      if (!skill) {
        const availableSkills = skills.map((s) => s.name).join(", ");
        throw new ContinueError(
          ContinueErrorReason.SkillNotFound,
          `Skill "${skill_name}" not found. Available skills: ${availableSkills || "none"}`,
        );
      }

      const contentParts = [
        `<skill name="${skill.name}">`,
        `# Skill: ${skill.name}`,
        "",
        skill.content.trim(),
      ];

      if (skill.files.length > 0) {
        const skillDir = skill.path.substring(
          0,
          skill.path.lastIndexOf("/"),
        );
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

      return contentParts.join("\n");
    },
  };
};
