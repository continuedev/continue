import type { IDE } from "core";
import {
  answeredDecisions,
  parsePlanFile,
  serializePlanFile,
  type PlanDecision,
} from "core/util/planFile";
import { buildTaskPlan } from "core/util/taskPlan";

/**
 * Records the person's answer to one of a plan's decisions in the plan file:
 * the file is read back (the person may have edited it meanwhile), the answer
 * is merged into its Decisions section by question text, and the file is
 * written again with its title, body and to-dos as parsed. Returns the file's
 * decisions with the answer in place.
 */
export async function recordPlanAnswer(
  ide: Pick<IDE, "readFile" | "writeFile">,
  fileUri: string,
  question: string,
  answer: string,
): Promise<PlanDecision[]> {
  const doc = parsePlanFile(await ide.readFile(fileUri));
  const decisions = answeredDecisions(doc.decisions, [
    { question, answer: answer.trim() },
  ]);
  // Nothing to record: an empty answer, or a question the file no longer has
  if (decisions.every((d, i) => d.answer === doc.decisions[i].answer)) {
    return doc.decisions;
  }
  // The parsed to-dos may lack ids; buildTaskPlan gives them the file's form.
  const built = buildTaskPlan(doc.items, { reset: true, updatedBy: "user" });
  if (!built.ok) {
    throw new Error(`The plan file's to-dos could not be read: ${built.error}`);
  }
  await ide.writeFile(
    fileUri,
    serializePlanFile({
      title: doc.title,
      body: doc.body,
      items: built.plan.items,
      decisions,
    }),
  );
  return decisions;
}
