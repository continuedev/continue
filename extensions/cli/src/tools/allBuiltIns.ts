import { editTool } from "./edit.js";
import { eventTool } from "./event.js";
import { exitTool } from "./exit.js";
import { fetchTool } from "./fetch.js";
import { listFilesTool } from "./listFiles.js";
import { multiEditTool } from "./multiEdit.js";
import { readFileTool } from "./readFile.js";
import { reportFailureTool } from "./reportFailure.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { searchCodeTool } from "./searchCode.js";
import { uploadArtifactTool } from "./uploadArtifact.js";
import { writeChecklistTool } from "./writeChecklist.js";
import { writeFileTool } from "./writeFile.js";

// putting in here for circular import issue
export const ALL_BUILT_IN_TOOLS = [
  readFileTool,
  editTool,
  multiEditTool,
  writeFileTool,
  listFilesTool,
  searchCodeTool,
  runTerminalCommandTool,
  fetchTool,
  writeChecklistTool,
  exitTool,
  reportFailureTool,
  uploadArtifactTool,
  eventTool,
];
