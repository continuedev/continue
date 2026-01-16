import { GetTool } from "../..";
import { loadMarkdownSkills } from "../../config/markdown/loadMarkdownSkills";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const readSkillTool: GetTool = async (params) => {
  const { skills } = await loadMarkdownSkills(params.ide);
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
      description: `
Use this tool to read the content of a skill by its name. Skills contain detailed instructions for specific tasks. The skill name should match one of the available skills listed below: 
${skills.map((skill) => `\nname: ${skill.name}\ndescription: ${skill.description}\n`)}`,
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
