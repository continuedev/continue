import { GetTool } from "../..";
import { loadMarkdownSkills } from "../../config/markdown/loadMarkdownSkills";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const readSkillTool: GetTool = async (params) => {
  const { skills } = await loadMarkdownSkills(params.ide);
  // Sorted and joined, so the description (part of every request's cached
  // prefix) does not change with the order the skill folders were read in
  const listed = [...skills]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(
      (skill) => `\nname: ${skill.name}\ndescription: ${skill.description}\n`,
    )
    .join("");
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
${listed}`,
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
