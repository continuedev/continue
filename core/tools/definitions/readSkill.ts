import { GetTool } from "../..";
import { loadMarkdownSkills } from "../../config/markdown/loadMarkdownSkills";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const readSkillTool: GetTool = async (params) => {
  const { skills } = await loadMarkdownSkills(params.ide, false);
  return {
    type: "function",
    displayTitle: "Read Skill",
    wouldLikeTo: "read skill {{{ skillName }}}",
    isCurrently: "reading skill {{{ skillName }}}",
    hasAlready: "read skill {{{ skillName }}}",
    readonly: true,
    isInstant: true,
    group: BUILT_IN_GROUP_NAME,
    function: {
      name: BuiltInToolNames.ReadSkill,
      description: `Read the full instructions for an available skill before carrying out a matching task. When the user asks to use a skill by name (including $skill-name), load that skill first. Follow its instructions and read supporting resources only when needed. Skills marked manualOnly must only be loaded when the user explicitly asks for that skill. Skills do not grant tool permissions; normal approval policies still apply.
Available skills:
${skills.map((skill) => JSON.stringify({ name: skill.name, description: skill.description, path: skill.path, manualOnly: skill["disable-model-invocation"] ?? false, argumentHint: skill["argument-hint"] })).join("\n")}`,
      parameters: {
        type: "object",
        required: ["skillName"],
        properties: {
          skillName: {
            type: "string",
            description:
              "The name of the skill to read. This should match the name from the available skills.",
          },
        },
      },
    },
  };
};
