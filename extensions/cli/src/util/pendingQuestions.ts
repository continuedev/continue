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

/** Whether a question is still waiting for the person. */
export function pendingQuestionState(
  held: PendingQuestion,
): "open" | "answered" {
  return held.answer === undefined ? "open" : "answered";
}

/**
 * The message that carries an answer back to the model: the question and its
 * id, and, when the model went on with a default the answer overrules, that
 * what depended on it must be looked at again.
 */
export function pendingAnswerMessage(held: PendingQuestion): string {
  const base = `Answer to your question "${held.question}" (id ${held.id}): ${held.answer}`;
  if (held.defaultAnswer && held.defaultAnswer !== held.answer) {
    return `${base}\nThis overrules the default you went on with ("${held.defaultAnswer}"): look again at whatever depended on it.`;
  }
  return base;
}

/**
 * Question types the agent may settle with its pick while the question is
 * held: a wrong answer is cheap to undo. Everything else, and a question with
 * no type, is the person's (plans/policy-areas.md, "Questions are about who
 * decides").
 */
const AGENT_MAY_PROCEED_TYPES = ["design", "detail"];

/**
 * What the model gets back when its question is held. The wording is neutral
 * about whether an answer comes (under cn serve it usually does, later), and
 * what to do meanwhile depends on the type: a cheap choice goes on with the
 * default; a choice that is the person's is not settled.
 */
export function heldQuestionResult(held: PendingQuestion): string {
  const where = `The question is held for the person (id ${held.id}); an answer arrives as a later message.`;
  if (held.type && AGENT_MAY_PROCEED_TYPES.includes(held.type)) {
    const fallback = held.defaultAnswer
      ? `go on with your default ("${held.defaultAnswer}")`
      : "go on with your recommended option";
    return `${where} It is a ${held.type} question, so ${fallback} and record it as an assumption in what you deliver.`;
  }
  const label = held.type
    ? `a ${held.type} question`
    : "a question with no type";
  return `${where} It is ${label}, so the choice is the person's: do not settle it. In plan mode put it in PresentPlan's decisions with the options and your pick, and write the to-dos so they do not presuppose an answer; otherwise do what does not depend on it and say what waits.`;
}

/** For tests. */
export function resetPendingQuestions(): void {
  questions.length = 0;
}
