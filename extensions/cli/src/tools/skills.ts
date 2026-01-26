import { ContinueError, ContinueErrorReason } from "core/util/errors.js";

import { loadMarkdownSkills } from "../util/loadMarkdownSkills.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

export const SKILLS_TOOL_META: Tool = {
  name: "Skills",
  displayName: "Skills",
  description:
    "Use this tool to read the content of a skill by its name. Skills contain detailed instructions for specific tasks.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["skill_name"],
    properties: {
      skill_name: {
        type: "string",
        description:
          "The name of the skill to read. This should match the name from the available skills.",
      },
    },
  },
  run: async () => "",
};

export const skillsTool = async (): Promise<Tool> => {
  const { skills } = await loadMarkdownSkills();

  return {
    ...SKILLS_TOOL_META,

    description: `Use this tool to read the content of a skill by its name. Skills contain detailed instructions for specific tasks. The skill name should match one of the available skills listed below:
${skills.map((skill) => `\nname: ${skill.name}\ndescription: ${skill.description}\n`)}`,

    preprocess: async (args: any) => {
      const { skill_name } = args;

      return {
        args,
        preview: [
          {
            type: "text",
            content: `Reading skill: ${skill_name}`,
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

      const content = [
        `<skill_name>${skill.name}</skill_name>`,
        `<skill_description>${skill.description}</skill_description>`,
        `<skill_content>${skill.content}</skill_content>`,
      ];

      if (skill.files.length > 0) {
        content.push(
          `<skill_files>${skill.files.join(",")}</skill_files>`,
          `<other_instructions>Use the read file tool to access skill files as needed.</other_instructions>`,
        );
      }

      return content.join("\n");
    },
  };
};
