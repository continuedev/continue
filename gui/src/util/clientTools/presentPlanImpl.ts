import { ContinueError, ContinueErrorReason } from "core/util/errors";
import {
  choosePlanFileName,
  planProposedResult,
  PLANS_DIR,
  serializePlanFile,
  taskPlanForProposal,
  validatePlanArgs,
} from "core/util/planFile";
import { joinPathsToUri } from "core/util/uri";
import { setPlanFile, setTaskPlan } from "../../redux/slices/sessionSlice";
import { ClientToolImpl } from "./callClientTool";

/**
 * The present_plan tool (Plan mode only): writes the plan to
 * `.continue/plans/<slug>.md` in the first workspace folder, makes its to-dos
 * the task list, records the file on the session and ends the turn. The plan
 * card (PlanCard) then offers Build and Keep planning.
 *
 * Presenting again with the same title replaces this session's file; a file
 * of that name that belongs to something else gets a numbered name instead.
 */
export const presentPlanImpl: ClientToolImpl = async (
  args,
  _toolCallId,
  extras,
) => {
  const parsed = validatePlanArgs(args ?? {});
  if (!parsed.ok) {
    throw new ContinueError(ContinueErrorReason.Unspecified, parsed.error);
  }
  const { session } = extras.getState();
  const result = taskPlanForProposal(parsed.items, session.taskPlan);
  if (!result.ok) {
    throw new ContinueError(ContinueErrorReason.Unspecified, result.error);
  }

  const ide = extras.ideMessenger.ide;
  const [workspaceDir] = await ide.getWorkspaceDirs();
  if (!workspaceDir) {
    throw new ContinueError(
      ContinueErrorReason.Unspecified,
      "No workspace folder is open, so the plan file cannot be saved. Give the plan in your reply instead.",
    );
  }
  const plansDir = joinPathsToUri(workspaceDir, ...PLANS_DIR.split("/"));
  const fileName = await choosePlanFileName(parsed.title, async (name) => {
    const uri = joinPathsToUri(plansDir, name);
    return uri !== session.planFile && (await ide.fileExists(uri));
  });
  const fileUri = joinPathsToUri(plansDir, fileName);
  const relativePath = `${PLANS_DIR}/${fileName}`;

  await ide.writeFile(
    fileUri,
    serializePlanFile({
      title: parsed.title,
      body: parsed.body,
      items: result.plan.items,
    }),
  );

  extras.dispatch(setTaskPlan(result.plan));
  extras.dispatch(setPlanFile(fileUri));

  return {
    respondImmediately: true,
    endTurn: true,
    output: [
      {
        name: parsed.title,
        description: relativePath,
        content: planProposedResult(relativePath, result.plan),
        uri: { type: "file", value: fileUri },
        hidden: false,
      },
    ],
  };
};
