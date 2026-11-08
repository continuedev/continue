import { beforeEach, describe, expect, it } from "vitest";

import {
  answerPendingQuestion,
  heldQuestionResult,
  holdPendingQuestion,
  listPendingQuestions,
  openPendingQuestions,
  pendingAnswerMessage,
  resetPendingQuestions,
} from "./pendingQuestions.js";

describe("pending questions", () => {
  beforeEach(() => resetPendingQuestions());

  it("holds a question, lists it as open, and tells the model to go on", () => {
    const held = holdPendingQuestion({
      question: "ISO or readable?",
      options: ["ISO 8601", "readable"],
      defaultAnswer: "ISO 8601",
      type: "scope",
    });
    expect(held.id).toHaveLength(8);
    expect(openPendingQuestions()).toEqual([held]);
    const text = heldQuestionResult(held);
    expect(text).toContain(`inbox (id ${held.id})`);
    expect(text).toContain('Go on with your default ("ISO 8601")');
    expect(text).toContain("PresentPlan's decisions");
  });

  it("records an answer once and builds the message for the model", () => {
    const held = holdPendingQuestion({ question: "Which one?" });
    expect(answerPendingQuestion("nope", "x")).toBeUndefined();
    const answered = answerPendingQuestion(held.id, "the second");
    expect(answered?.answer).toBe("the second");
    expect(openPendingQuestions()).toEqual([]);
    expect(listPendingQuestions()[0].answeredAt).toBeDefined();
    expect(answerPendingQuestion(held.id, "again")).toBeUndefined();
    expect(pendingAnswerMessage(answered!)).toBe(
      'Answer to your question "Which one?": the second',
    );
  });

  it("without a default, says to go on with the recommended option", () => {
    const held = holdPendingQuestion({ question: "Which one?" });
    expect(heldQuestionResult(held)).toContain(
      "Go on with your recommended option",
    );
  });
});
