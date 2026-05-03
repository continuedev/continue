/**
 * AskUserQuestionTool — ported and adapted from Marcel (Yuto Code) AskUserQuestionTool.
 *
 * Lets the agent pause mid-execution and ask the user one or more structured
 * multiple-choice questions.  The tool suspends the agent turn, sends
 * `agent/askUserQuestion` to the GUI over the protocol, waits for the
 * `agent/questionAnswer` reply, then returns the answers as context for the LLM.
 *
 * The GUI is responsible for rendering the question UI and collecting answers.
 */
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export interface AskUserQuestionOption {
  label: string;
  description: string;
  /** Optional markdown/html preview shown when this option is highlighted */
  preview?: string;
}

export interface AskUserQuestion {
  /** Full question text, ending with "?" */
  question: string;
  /** Short chip label, max 12 chars */
  header: string;
  /** 2–4 choices */
  options: AskUserQuestionOption[];
  /** Allow multiple selections */
  multiSelect?: boolean;
}

export const askUserQuestionTool: Tool = {
  type: "function",
  displayTitle: "Ask User Question",
  wouldLikeTo: "ask you a question",
  isCurrently: "waiting for your answer",
  hasAlready: "asked you a question",
  readonly: true,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.AskUserQuestion,
    description: `Asks the user one or more structured multiple-choice questions to gather information, clarify ambiguity, or make decisions during task execution.

Guidelines:
- Use this when you genuinely need human input before proceeding (not just to confirm obvious steps).
- Each question must have 2–4 options. Users can always type a custom answer.
- Keep question text clear and specific, ending with "?".
- Keep header short (max 12 chars), e.g. "Auth method", "Library", "Approach".
- If you recommend an option, put "(Recommended)" at the end of its label.
- Do NOT use this to ask "Should I proceed?" for simple next steps — just proceed.`,
    parameters: {
      type: "object",
      required: ["questions"],
      properties: {
        questions: {
          type: "array",
          description: "Questions to ask the user (1–4 questions).",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            required: ["question", "header", "options"],
            properties: {
              question: {
                type: "string",
                description:
                  "The complete question text, ending with a question mark.",
              },
              header: {
                type: "string",
                description:
                  "Very short label (max 12 chars) shown as a chip, e.g. 'Auth method'.",
              },
              options: {
                type: "array",
                description: "Available choices (2–4 options).",
                minItems: 2,
                maxItems: 4,
                items: {
                  type: "object",
                  required: ["label", "description"],
                  properties: {
                    label: {
                      type: "string",
                      description: "Short display text for this option (1–5 words).",
                    },
                    description: {
                      type: "string",
                      description:
                        "Explanation of what this option means or implies.",
                    },
                    preview: {
                      type: "string",
                      description:
                        "Optional markdown preview content shown when this option is focused (code snippets, mockups, etc.).",
                    },
                  },
                },
              },
              multiSelect: {
                type: "boolean",
                description:
                  "Set true to allow the user to select multiple options. Default: false.",
              },
            },
          },
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
  systemMessageDescription: {
    prefix: `To ask the user a clarifying question mid-task, use the ${BuiltInToolNames.AskUserQuestion} tool. For example:`,
    exampleArgs: [
      [
        "questions",
        JSON.stringify([
          {
            question: "Which testing framework should we use?",
            header: "Test framework",
            options: [
              {
                label: "Vitest (Recommended)",
                description: "Fast, native ESM, compatible with Jest API.",
              },
              {
                label: "Jest",
                description: "Widely used, large ecosystem.",
              },
            ],
          },
        ]),
      ],
    ],
  },
};
