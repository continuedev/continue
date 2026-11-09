import type { ChatMessage, ILLM } from "../../..";
import { requestOf, type TurnScenario } from "./scenarios";

type Chat = Pick<ILLM, "chat">;

function firstUserText(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  return typeof first?.content === "string" ? first.content : "";
}

/**
 * Stand-ins for a model. They prove that the harness and the bar work, and
 * say nothing about a real model.
 */

/** Follows the prompt in every scenario: replies with the scenario's oracle message. */
export function oracleModel(scenarios: TurnScenario[]): Chat {
  return {
    chat: async (messages: ChatMessage[]) => {
      const request = firstUserText(messages);
      const hit = scenarios.find((s) => requestOf(s) === request);
      if (!hit) {
        return { role: "assistant", content: "I do not know this scenario." };
      }
      return hit.oracle;
    },
  };
}

/**
 * The failure the bar exists to catch: describes the work in text and never
 * calls a tool. In an act turn it lists the steps and asks to proceed; in a
 * plan turn it writes the plan, decides what it was told not to, and asks
 * whether the plan is all right.
 */
export const textOnlyModel: Chat = {
  chat: async (messages: ChatMessage[]) => {
    const system = messages.find((m) => m.role === "system");
    const planning =
      typeof system?.content === "string" && /plan mode/i.test(system.content);
    const content = planning
      ? [
          "Here is the plan.",
          "",
          "1. Add formatDate(date) to src/dates.js. It returns an ISO 8601 string (2026-11-08), which is the common choice.",
          "2. Add test/dates.test.js following test/slugify.test.js.",
          "3. Run npm test.",
          "",
          "Is this plan all right? Let me know if you want changes before I present it.",
        ].join("\n")
      : [
          "I will take these steps:",
          "",
          "1. Read src/strings.js to match its style.",
          "2. Run `npm test` to check the tests, which should pass this time.",
          "3. Create the remaining file.",
          "",
          "Would you like me to proceed?",
        ].join("\n");
    return { role: "assistant", content };
  },
};
