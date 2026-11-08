import { randomUUID } from "crypto";

/**
 * Questions asked while nobody is there to answer (cn serve and headless
 * runs, outside a loop). The model does not wait: the question is held here,
 * shown in serve's /state as `pendingQuestions`, and the answer arrives as a
 * message (`POST /message { answerQuestion: id, answer }`) in a later turn.
 * The model goes on with its default meanwhile, as plans/policy-areas.md
 * says of the inbox.
 */
export interface PendingQuestion {
  id: string;
  question: string;
  options?: string[];
  /** The model's default, which stands until the answer arrives. */
  defaultAnswer?: string;
  /** What a wrong answer would cost, as the model labelled it. */
  type?: string;
  askedAt: string;
  answer?: string;
  answeredAt?: string;
}

const questions: PendingQuestion[] = [];

export function holdPendingQuestion(input: {
  question: string;
  options?: string[];
  defaultAnswer?: string;
  type?: string;
}): PendingQuestion {
  const held: PendingQuestion = {
    id: randomUUID().slice(0, 8),
    question: input.question,
    ...(input.options?.length ? { options: input.options } : {}),
    ...(input.defaultAnswer ? { defaultAnswer: input.defaultAnswer } : {}),
    ...(input.type ? { type: input.type } : {}),
    askedAt: new Date().toISOString(),
  };
  questions.push(held);
  return held;
}

/** Every held question, answered ones included, oldest first. */
export function listPendingQuestions(): PendingQuestion[] {
  return questions.map((q) => ({ ...q }));
}

/** The questions still waiting for an answer. */
export function openPendingQuestions(): PendingQuestion[] {
  return listPendingQuestions().filter((q) => q.answer === undefined);
}

/** Records the answer; undefined when no open question has that id. */
export function answerPendingQuestion(
  id: string,
  answer: string,
): PendingQuestion | undefined {
  const held = questions.find((q) => q.id === id && q.answer === undefined);
  if (!held) return undefined;
  held.answer = answer;
  held.answeredAt = new Date().toISOString();
  return { ...held };
}

/** The message that carries an answer back to the model. */
export function pendingAnswerMessage(held: PendingQuestion): string {
  return `Answer to your question "${held.question}": ${held.answer}`;
}

/** What the model gets back when its question is held. */
export function heldQuestionResult(held: PendingQuestion): string {
  const fallback = held.defaultAnswer
    ? `Go on with your default ("${held.defaultAnswer}")`
    : "Go on with your recommended option";
  return `Nobody can answer now: the question is in the person's inbox (id ${held.id}) and the answer, if one comes, arrives in a later message. ${fallback}. If the choice is the person's to make, do not settle it: in plan mode put it in PresentPlan's decisions with the options and your pick; otherwise record it as an assumption in what you deliver.`;
}

/** For tests. */
export function resetPendingQuestions(): void {
  questions.length = 0;
}
