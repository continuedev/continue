import { services } from "../services/index.js";
import { quizService } from "../services/QuizService.js";
import {
  heldQuestionResult,
  holdPendingQuestion,
} from "../util/pendingQuestions.js";

import { Tool } from "./types.js";

/**
 * What a question is about, as the agent labels it. Recorded for the person
 * and for the Questions level (plans/policy-areas.md); the label never on its
 * own decides who answers.
 */
export const QUESTION_TYPES = [
  "access",
  "irreversible",
  "security",
  "cost",
  "scope",
  "design",
  "detail",
] as const;

export const askQuestionTool: Tool = {
  name: "AskQuestion",
  displayName: "Ask Question",
  description: `Ask the person one question. An interactive run waits for the answer; in cn serve and headless runs the question is held for the person and the result says how to go on. Use it for a preference or trade-off that would change the result and that reading the code cannot settle; facts about the code are found, not asked. Give two to four options with your recommended one first and in defaultAnswer; the person can always answer in their own words, so do not add "other". Set type to what a wrong answer would cost: access (something only the person can supply), irreversible, security, cost, scope, design or detail. If the answer does not come, decide a small thing with your default and say so; a choice that is the person's goes in PresentPlan's decisions in plan mode and is not settled by you.`,
  parameters: {
    type: "object",
    required: ["question", "options"],
    properties: {
      question: {
        type: "string",
        description: "The question to ask the user",
      },
      options: {
        type: "array",
        description:
          "Two to four choices, your recommended one first. Leave empty only if the person must answer in their own words.",
        items: {
          type: "string",
        },
      },
      defaultAnswer: {
        type: "string",
        description:
          "Your recommended answer, used if the person presses Enter without choosing",
      },
      type: {
        type: "string",
        enum: [...QUESTION_TYPES],
        description: "What a wrong answer would cost",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  run: async (args: {
    question: string;
    options?: string[];
    defaultAnswer?: string;
    type?: string;
  }): Promise<string> => {
    const { question, options, defaultAnswer } = args;

    // cn serve and headless runs: nobody is at a question box, so the
    // question is held in the inbox (serve /state) and the model goes on with
    // its default; the answer, if one comes, arrives as a later message.
    if (services.toolPermissions.isHeadless()) {
      return heldQuestionResult(
        holdPendingQuestion({
          question,
          options,
          defaultAnswer,
          type: args.type,
        }),
      );
    }

    const answer = await quizService.askQuestion({
      question,
      options,
      defaultAnswer,
    });

    if (options && options.length > 0) {
      const selectedIndex = options.indexOf(answer);
      if (selectedIndex !== -1) {
        return `User selected option ${selectedIndex + 1}: "${answer}"`;
      }
      return `User provided custom answer: "${answer}"`;
    }

    return `User answered: "${answer}"`;
  },
};
