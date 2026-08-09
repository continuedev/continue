import { quizService } from "../services/QuizService.js";

import { Tool } from "./types.js";

export const askQuestionTool: Tool = {
  name: "AskQuestion",
  displayName: "Ask Question",
  description: `Ask the user a clarifying question to gather requirements, preferences, or implementation details before proceeding.
Guidelines:
- You should use this tool **whenever you want to clarify your assumption or need answers to build your plan**.
- DO NOT supply "other" or "none of the above" or similar as an option. User can always provide a free-form answer when needed.
`,
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
          "The list of choices. Leave as empty array if user should provide a free-form answer.",
        items: {
          type: "string",
        },
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
    defaultAnswer?: string;
  }): Promise<string> => {
    const { question, options, defaultAnswer } = args;

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
