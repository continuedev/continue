import { GetTool } from "../..";
import { loadMarkdownSkills } from "../../config/markdown/loadMarkdownSkills";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const skillTool: GetTool = async (params) => {
  const { skills } = await loadMarkdownSkills(params.ide);
  const listedSkills = skills
    .map((skill) => {
      const whenToUse = skill.whenToUse ? ` (when: ${skill.whenToUse})` : "";
      return `- ${skill.name}: ${skill.description}${whenToUse}`;
    })
    .join("\n");

  return {
    type: "function",
    displayTitle: "Skill",
    wouldLikeTo: "invoke skill {{{ skill }}}",
    isCurrently: "loading skill {{{ skill }}}",
    hasAlready: "loaded skill {{{ skill }}}",
    readonly: true,
    isInstant: true,
    group: BUILT_IN_GROUP_NAME,
    function: {
      name: BuiltInToolNames.Skill,
      description: `Execute a skill within the current conversation by loading its instructions into context.

Use this when the user asks for a slash-command-style workflow or when one of the available skills directly matches the requested task.

Important:
- If the user references a slash command like /commit or /review-pr, use this tool.
- After calling this tool, follow the returned skill instructions directly.
- Do not mention a skill without calling this tool first.

Available skills:
${listedSkills || "(none found)"}`,
      parameters: {
        type: "object",
        required: ["skill"],
        properties: {
          skill: {
            type: "string",
            description:
              "Skill name to invoke. You can pass either the raw skill name or slash-command style input like '/commit'.",
          },
          args: {
            type: "string",
            description:
              "Optional arguments or user-provided context to pass along with the skill. Use the skill's argument hint when available.",
          },
        },
      },
    },
    defaultToolPolicy: "allowedWithoutPermission",
    systemMessageDescription: {
      prefix: `To load and execute a skill, use the ${BuiltInToolNames.Skill} tool. For example:`,
      exampleArgs: [
        ["skill", "/commit"],
        ["args", "Fix the auth regression and create a commit message"],
      ],
    },
    toolCallIcon: "AcademicCapIcon",
  };
};
