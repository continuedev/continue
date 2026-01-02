import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const readSkillTool: Tool = {
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
    description:
      "Use this tool to read the content of a skill by its name. Skills contain detailed instructions for specific tasks. The skill name should match one of the available skills listed in the system message.",
    parameters: {
      type: "object",
      required: ["skillName"],
      properties: {
        skillName: {
          type: "string",
          description:
            "The name of the skill to read. This should match the name field from the available skills.",
        },
      },
    },
  },
};
