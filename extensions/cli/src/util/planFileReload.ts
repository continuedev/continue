import fs from "fs";

import { taskPlanFromPlanFile } from "core/util/planFile.js";

import { getSessionTaskPlan, updateSessionTaskPlan } from "../session.js";

/**
 * Read the plan file back (the person may have edited it in their editor
 * while a question was open) and make its checkboxes the task list. A file
 * that cannot be read or breaks the list rules leaves the list as is.
 */
export function reloadPlanFile(file: string): void {
  try {
    const result = taskPlanFromPlanFile(
      fs.readFileSync(file, "utf-8"),
      getSessionTaskPlan(),
    );
    if (result.ok) {
      updateSessionTaskPlan(result.plan);
    }
  } catch {
    // The model is told to read the file anyway.
  }
}
