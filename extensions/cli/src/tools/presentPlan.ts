import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

import {
  choosePlanFileName,
  PLAN_LIMITS,
  planBuildMessage,
  planKeepPlanningResult,
  PLANS_DIR,
  PRESENT_PLAN_CLI_TOOL_NAME,
  PRESENT_PLAN_TODO_DETAILS_PARAMETER,
  PRESENT_PLAN_TOOL_DESCRIPTION,
  serializePlanFile,
  taskPlanForProposal,
  validatePlanArgs,
} from "core/util/planFile.js";
import { TASK_PLAN_LIMITS, taskPlanToMarkdown } from "core/util/taskPlan.js";

import { safeStderr } from "../init.js";
import {
  getSessionLoop,
  isLoopEntry,
  requestLoopTurnEnd,
  startLoopFromPlan,
} from "../loop/loopSession.js";
import { services } from "../services/index.js";
import { quizService } from "../services/QuizService.js";
import {
  getSessionPlanFile,
  getSessionTaskPlan,
  updateSessionPlanFile,
  updateSessionTaskPlan,
} from "../session.js";
import { reloadPlanFile } from "../util/planFileReload.js";

import type { Tool } from "./types.js";

export const PRESENT_PLAN_BUILD = "Build";
export const PRESENT_PLAN_BUILD_IN_LOOP = "Build in a loop";
export const PRESENT_PLAN_KEEP_PLANNING = "Keep planning";

interface PresentPlanArgs {
  title?: unknown;
  plan?: unknown;
  todos?: unknown;
  todo_details?: unknown;
}

function checkedArgs(args: PresentPlanArgs) {
  const parsed = validatePlanArgs(args ?? {});
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed;
}

/**
 * Writes the plan to `.continuous/plans/<slug>.md` under the working directory
 * and makes its to-dos the session's task list. Presenting again with the same
 * title replaces this session's file; a file of that name that belongs to
 * something else gets a numbered name.
 */
export async function savePlan(args: PresentPlanArgs, cwd = process.cwd()) {
  const parsed = checkedArgs(args);
  const result = taskPlanForProposal(parsed.items, getSessionTaskPlan());
  if (!result.ok) {
    throw new Error(result.error);
  }
  const dir = path.join(cwd, ...PLANS_DIR.split("/"));
  const ownFile = getSessionPlanFile();
  const fileName = await choosePlanFileName(parsed.title, (name) => {
    const file = path.join(dir, name);
    return pathToFileURL(file).href !== ownFile && fs.existsSync(file);
  });
  const file = path.join(dir, fileName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    file,
    serializePlanFile({
      title: parsed.title,
      body: parsed.body,
      items: result.plan.items,
    }),
  );
  // The file first: the task list change re-renders the progress strip,
  // which shows the plan's name.
  updateSessionPlanFile(pathToFileURL(file).href);
  updateSessionTaskPlan(result.plan);
  return {
    file,
    relativePath: `${PLANS_DIR}/${fileName}`,
    plan: result.plan,
  };
}

/**
 * Build: read the plan file back and make its checkboxes the task list
 * (src/util/planFileReload.ts).
 */
export { reloadPlanFile };

/** The plan question: Build, Build in a loop, Keep planning, or a change. */
function askBuild(relativePath: string): Promise<string> {
  return quizService.askQuestion({
    question: `Build this plan? It is saved in ${relativePath}; edit the file first if you like. Or type what to change.`,
    options: [
      PRESENT_PLAN_BUILD,
      PRESENT_PLAN_BUILD_IN_LOOP,
      PRESENT_PLAN_KEEP_PLANNING,
    ],
    defaultAnswer: PRESENT_PLAN_BUILD,
  });
}

export const presentPlanTool: Tool = {
  name: PRESENT_PLAN_CLI_TOOL_NAME,
  displayName: "Present Plan",
  description: PRESENT_PLAN_TOOL_DESCRIPTION,
  // It writes only its own plan file under .continuous/plans, never the
  // person's code. It is offered in plan mode only (getAllAvailableTools).
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["title", "plan", "todos"],
    properties: {
      title: {
        type: "string",
        description: `A short name for the work, at most ${PLAN_LIMITS.maxTitleLength} characters. It names the file in ${PLANS_DIR}.`,
      },
      plan: {
        type: "string",
        description:
          "The plan in markdown for a person to read: goal, approach, files involved, risks. Not the to-dos.",
      },
      todos: {
        type: "array",
        description: `The implementation steps in order, at most ${TASK_PLAN_LIMITS.maxItems}, each at most ${TASK_PLAN_LIMITS.maxTextLength} characters.`,
        items: { type: "string" },
      },
      todo_details: PRESENT_PLAN_TODO_DETAILS_PARAMETER as any,
    },
  },
  preprocess: async (args: PresentPlanArgs) => {
    const parsed = checkedArgs(args);
    const preview = [
      { type: "text" as const, content: `Plan: ${parsed.title}` },
      ...(parsed.body
        ? [{ type: "text" as const, content: parsed.body, paddingLeft: 2 }]
        : []),
      {
        type: "checklist" as const,
        content: parsed.items.map((i) => `- [ ] ${String(i.text)}`).join("\n"),
      },
    ];
    return { args, preview };
  },
  run: async (args: PresentPlanArgs): Promise<string> => {
    const { file, relativePath, plan } = await savePlan(args);

    // Loop mode's re-plan: the loop decides whether the new plan starts the
    // next round by itself (its autonomy level) or waits for the person in
    // the inbox, so nobody is asked here and the turn ends.
    if (getSessionLoop()?.current?.kind === "replan") {
      requestLoopTurnEnd();
      return `Plan saved to ${relativePath} with ${plan.items.length} to-dos. End your turn now.`;
    }

    if (services.toolPermissions.isHeadless()) {
      // Nobody can approve: the file is the result.
      safeStderr(`Plan saved to ${relativePath}\n`);
      return `Plan saved to ${relativePath} with ${plan.items.length} to-dos. This is a headless run, so nobody can approve it now: do not implement anything. Stop, and end your reply with the line "Plan: ${relativePath}".`;
    }

    // The loop entry (Shift+Tab): the person already chose to build in a loop
    const answer = isLoopEntry()
      ? PRESENT_PLAN_BUILD_IN_LOOP
      : await askBuild(relativePath);

    if (answer === PRESENT_PLAN_BUILD) {
      reloadPlanFile(file);
      services.toolPermissions.switchMode("normal");
      return `The user approved the plan and switched out of plan mode, so you can now edit files (each edit asks for approval). ${planBuildMessage(relativePath)}\n\nCurrent task list:\n${taskPlanToMarkdown(getSessionTaskPlan())}`;
    }
    if (answer === PRESENT_PLAN_BUILD_IN_LOOP) {
      // Loop mode: the CLI runs the to-dos one at a time, each in its own
      // turn with a fresh context (src/loop/loopDriver.ts). This turn ends.
      services.toolPermissions.switchMode("normal");
      if (startLoopFromPlan("normal")) {
        requestLoopTurnEnd();
        return "The user approved the plan and chose to build it in a loop: each to-do will be given to you on its own turn. Do not start on it now; end your turn.";
      }
      reloadPlanFile(file);
      return `The user approved the plan and switched out of plan mode. ${planBuildMessage(relativePath)}`;
    }
    return planKeepPlanningResult(
      answer === PRESENT_PLAN_KEEP_PLANNING ? undefined : answer,
    );
  },
};
