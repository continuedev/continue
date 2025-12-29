import { Skill } from "..";

export function getSystemMessageWithSkills(
  systemMessage: string,
  skills: Skill[],
) {
  const lines = [
    "You have access to skills listed in `<available_skills>`. When a task matches a skill's description, read its SKILL.md file to get detailed instructions.",
    "",
    "<available_skills>",
  ];
  for (const skill of skills) {
    lines.push("    <skill>");
    lines.push(`        <name>${skill.name}</name>`);
    lines.push(`        <description>${skill.description}</description>`);
    lines.push(`        <location>${skill.path}</location>`);
    lines.push("    </skill>");
  }
  lines.push("</available_skills>");

  console.log("debug1 with skills", lines.join("\n"));

  return systemMessage + "\n\n" + lines.join("\n");
}
