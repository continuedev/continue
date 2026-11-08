import { SUBAGENT_TOOL_META } from "../subagent/index.js";

import { askQuestionTool } from "./askQuestion.js";
import { editTool } from "./edit.js";
import { exitTool } from "./exit.js";
import { fetchTool } from "./fetch.js";
import { listFilesTool } from "./listFiles.js";
import { finishItemTool, holdQuestionTool, remindMeTool } from "./loopTools.js";
import { multiEditTool } from "./multiEdit.js";
import { presentPlanTool } from "./presentPlan.js";
import { readFileTool } from "./readFile.js";
import { reportFailureTool } from "./reportFailure.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { searchCodeTool } from "./searchCode.js";
import { SKILLS_TOOL_META } from "./skills.js";
import { statusTool } from "./status.js";
import { taskListTool } from "./taskList.js";
import { uploadArtifactTool } from "./uploadArtifact.js";
import { viewDiffTool } from "./viewDiff.js";
import { writeChecklistTool } from "./writeChecklist.js";
import { writeFileTool } from "./writeFile.js";

// putting in here for circular import issue
export const ALL_BUILT_IN_TOOLS = [
  askQuestionTool,
  editTool,
  exitTool,
  fetchTool,
  finishItemTool,
  holdQuestionTool,
  remindMeTool,
  listFilesTool,
  multiEditTool,
  presentPlanTool,
  readFileTool,
  reportFailureTool,
  runTerminalCommandTool,
  searchCodeTool,
  statusTool,
  taskListTool,
  SUBAGENT_TOOL_META,
  SKILLS_TOOL_META,
  uploadArtifactTool,
  viewDiffTool,
  writeChecklistTool,
  writeFileTool,
];
