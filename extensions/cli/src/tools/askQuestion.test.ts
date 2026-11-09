import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ headless: false }));

vi.mock("../services/index.js", () => ({
  services: { toolPermissions: { isHeadless: () => store.headless } },
}));
vi.mock("../services/QuizService.js", () => ({
  quizService: { askQuestion: vi.fn(async () => "readable") },
}));

import { quizService } from "../services/QuizService.js";
import {
  openPendingQuestions,
  resetPendingQuestions,
} from "../util/pendingQuestions.js";

import { askQuestionTool } from "./askQuestion.js";

const args = {
  question: "ISO or readable?",
  options: ["ISO 8601", "readable"],
  defaultAnswer: "ISO 8601",
  type: "scope",
};

describe("AskQuestion", () => {
  beforeEach(() => {
    store.headless = false;
    resetPendingQuestions();
    vi.mocked(quizService.askQuestion).mockClear();
  });

  it("asks and reports the chosen option", async () => {
    const result = await askQuestionTool.run(args);
    expect(quizService.askQuestion).toHaveBeenCalledOnce();
    expect(result).toBe('User selected option 2: "readable"');
  });

  it("headless: holds the question in the inbox and does not wait", async () => {
    store.headless = true;
    const result = await askQuestionTool.run(args);
    expect(quizService.askQuestion).not.toHaveBeenCalled();
    const [held] = openPendingQuestions();
    expect(held).toMatchObject({
      question: "ISO or readable?",
      options: ["ISO 8601", "readable"],
      defaultAnswer: "ISO 8601",
      type: "scope",
    });
    expect(result).toContain(`held for the person (id ${held.id})`);
    expect(result).toContain("the choice is the person's");
  });
});
