import { quizService } from "../quiz/index.js";

import { Tool } from "./types.js";

export const askQuestionTool: Tool = {
  name: "AskQuestion",
  displayName: "Ask Question",
  description:
    "Ask the user a clarifying question to gather requirements, preferences, or implementation details before proceeding. Use this when you need user input to make a decision.",
  parameters: {
    type: "object",
    required: ["question"],
    properties: {
      question: {
        type: "string",
        description: "The question to ask the user",
      },
      options: {
        type: "array",
        description:
          "Optional list of choices. If provided, user selects one. If omitted, user types a free-form answer.",
        items: {
          type: "string",
        },
      },
      allowCustomAnswer: {
        type: "boolean",
        description:
          "If true and options are provided, user can also type a custom answer instead of selecting from options",
      },
      defaultAnswer: {
        type: "string",
        description:
          "Default answer if user presses Enter without providing input",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  run: async (args: {
    question: string;
    options?: string[];
    allowCustomAnswer?: boolean;
    defaultAnswer?: string;
  }): Promise<string> => {
    const { question, options, allowCustomAnswer, defaultAnswer } = args;

    const answer = await quizService.askQuestion({
      question,
      options,
      allowCustomAnswer,
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
