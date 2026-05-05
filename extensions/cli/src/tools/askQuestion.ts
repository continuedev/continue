import { quizService } from "../services/QuizService.js";

import { Tool } from "./types.js";

type AskQuestionOptionInput =
  | string
  | {
      label: string;
      description?: string;
      preview?: string;
    };

interface AskQuestionInput {
  question: string;
  header?: string;
  options?: AskQuestionOptionInput[];
  multiSelect?: boolean;
  allowFreeformInput?: boolean;
  defaultAnswer?: string;
}

function normalizeOptions(
  options?: AskQuestionOptionInput[],
): { label: string; description?: string; preview?: string }[] | undefined {
  if (!Array.isArray(options) || options.length === 0) {
    return undefined;
  }

  const normalized = options
    .map((option) => {
      if (typeof option === "string") {
        return { label: option };
      }

      if (option && typeof option.label === "string" && option.label.trim()) {
        return {
          label: option.label,
          description: option.description,
          preview: option.preview,
        };
      }

      return undefined;
    })
    .filter(
      (
        option,
      ): option is { label: string; description?: string; preview?: string } =>
        Boolean(option),
    );

  return normalized.slice(0, 4);
}

function normalizeQuestion(input: AskQuestionInput): AskQuestionInput {
  return {
    question: input.question,
    header: input.header,
    options: normalizeOptions(input.options),
    multiSelect: input.multiSelect,
    allowFreeformInput: input.allowFreeformInput,
    defaultAnswer: input.defaultAnswer,
  };
}

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
    properties: {
      questions: {
        type: "array",
        description:
          "Structured questions to ask (recommended). Supports rich options and multi-select.",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          required: ["question"],
          properties: {
            question: {
              type: "string",
              description: "The question to ask the user",
            },
            header: {
              type: "string",
              description: "Short label for the question (optional)",
            },
            options: {
              type: "array",
              description:
                "Choice list. Use strings or rich option objects. Leave empty for free-form input.",
              items: {
                oneOf: [
                  { type: "string" },
                  {
                    type: "object",
                    required: ["label"],
                    properties: {
                      label: {
                        type: "string",
                      },
                      description: {
                        type: "string",
                      },
                      preview: {
                        type: "string",
                      },
                    },
                  },
                ],
              },
            },
            multiSelect: {
              type: "boolean",
              description:
                "Whether the question allows selecting multiple options.",
            },
            allowFreeformInput: {
              type: "boolean",
              description:
                "Whether the user can provide a custom typed answer (default true).",
            },
            defaultAnswer: {
              type: "string",
              description:
                "Default answer if user presses Enter without providing input",
            },
          },
        },
      },
      question: {
        type: "string",
        description: "Legacy single-question field",
      },
      options: {
        type: "array",
        description: "Legacy single-question choices",
        items: {
          type: "string",
        },
      },
      multiSelect: {
        type: "boolean",
        description: "Legacy single-question multi-select",
      },
      allowFreeformInput: {
        type: "boolean",
        description: "Legacy single-question free-form toggle",
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
    questions?: AskQuestionInput[];
    question?: string;
    header?: string;
    options?: AskQuestionOptionInput[];
    multiSelect?: boolean;
    allowFreeformInput?: boolean;
    defaultAnswer?: string;
  }): Promise<string> => {
    const normalizedQuestions: AskQuestionInput[] = Array.isArray(
      args.questions,
    )
      ? args.questions.map(normalizeQuestion)
      : args.question
        ? [
            normalizeQuestion({
              question: args.question,
              header: args.header,
              options: args.options,
              multiSelect: args.multiSelect,
              allowFreeformInput: args.allowFreeformInput,
              defaultAnswer: args.defaultAnswer,
            }),
          ]
        : [];

    const cappedQuestions = normalizedQuestions.slice(0, 4);

    if (cappedQuestions.length === 0) {
      throw new Error("AskQuestion requires either `questions` or `question`.");
    }

    const responses: Array<{
      question: string;
      answer: string | string[];
      isCustomAnswer: boolean;
    }> = [];

    for (let i = 0; i < cappedQuestions.length; i++) {
      const question = cappedQuestions[i];
      const questionIndex = i + 1;
      const totalQuestions = cappedQuestions.length;
      const generatedHeader =
        totalQuestions > 1 ? `Q${questionIndex}/${totalQuestions}` : undefined;

      const answer = await quizService.askQuestion({
        question: question.question,
        header: question.header ?? generatedHeader,
        options: question.options,
        multiSelect: question.multiSelect,
        allowFreeformInput: question.allowFreeformInput,
        defaultAnswer: question.defaultAnswer,
      });

      responses.push({
        question: question.question,
        answer,
        isCustomAnswer: !Array.isArray(answer)
          ? !question.options?.some((option) => option.label === answer)
          : false,
      });
    }

    if (responses.length === 1) {
      const response = responses[0];
      if (Array.isArray(response.answer)) {
        return `User selected options: ${response.answer.map((option) => `"${option}"`).join(", ")}`;
      }
      if (response.isCustomAnswer) {
        return `User provided custom answer: "${response.answer}"`;
      }
      const selectedIndex = cappedQuestions[0].options?.findIndex(
        (option) => option.label === response.answer,
      );
      if (selectedIndex !== undefined && selectedIndex >= 0) {
        return `User selected option ${selectedIndex + 1}: "${response.answer}"`;
      }
      return `User answered: "${response.answer}"`;
    }

    return `User answers: ${JSON.stringify(responses)}`;
  },
};
