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
    expect(text).toContain(`held for the person (id ${held.id})`);
    // scope is the person's: the default is not a licence to go on
    expect(text).toContain("a scope question, so the choice is the person's");
    expect(text).toContain("PresentPlan's decisions");
    expect(text).not.toContain("go on with your default");
  });

  it("lets a design or detail question go on with the default", () => {
    const held = holdPendingQuestion({
      question: "Tabs or spaces?",
      defaultAnswer: "spaces",
      type: "detail",
    });
    const text = heldQuestionResult(held);
    expect(text).toContain(
      'a detail question, so go on with your default ("spaces")',
    );
    expect(text).toContain("record it as an assumption");
  });

  it("treats a question with no type as the person's", () => {
    const held = holdPendingQuestion({ question: "Which one?" });
    expect(heldQuestionResult(held)).toContain(
      "a question with no type, so the choice is the person's",
    );
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
      `Answer to your question "Which one?" (id ${held.id}): the second`,
    );
  });

  it("an answer that overrules the default says so", () => {
    const held = holdPendingQuestion({
      question: "Tabs or spaces?",
      defaultAnswer: "spaces",
      type: "detail",
    });
    const answered = answerPendingQuestion(held.id, "tabs")!;
    expect(pendingAnswerMessage(answered)).toContain(
      'This overrules the default you went on with ("spaces")',
    );
    const same = holdPendingQuestion({
      question: "Tabs or spaces?",
      defaultAnswer: "spaces",
      type: "detail",
    });
    expect(
      pendingAnswerMessage(answerPendingQuestion(same.id, "spaces")!),
    ).not.toContain("overrules");
  });

  it("a design question without a default goes on with the recommended option", () => {
    const held = holdPendingQuestion({
      question: "Which one?",
      type: "design",
    });
    expect(heldQuestionResult(held)).toContain(
      "go on with your recommended option",
    );
  });
});
