import { SUBAGENT_TOOL_META } from "../subagent/index.js";

import { askQuestionTool } from "./askQuestion.js";
import { configTool } from "./configTool.js";
import { editTool } from "./edit.js";
import { exitTool } from "./exit.js";
import { fetchTool } from "./fetch.js";
import { gitTool } from "./git.js";
import { grepTool } from "./grep.js";
import { globTool } from "./glob.js";
import { githubTool } from "./github.js";
import { listFilesTool } from "./listFiles.js";
import { listMcpResourcesTool } from "./listMcpResources.js";
import { mcpAuthTool } from "./mcpAuth.js";
import { multiEditTool } from "./multiEdit.js";
import { readFileTool } from "./readFile.js";
import { readMcpResourceTool } from "./readMcpResource.js";
import { reportFailureTool } from "./reportFailure.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { searchCodeTool } from "./searchCode.js";
import { sendMessageTool } from "./sendMessage.js";
import { SKILLS_TOOL_META } from "./skills.js";
import { sleepTool } from "./sleep.js";
import { statusTool } from "./status.js";
import { taskCreateTool } from "./taskCreate.js";
import { taskGetTool } from "./taskGet.js";
import { taskListTool } from "./taskList.js";
import { taskOutputTool } from "./taskOutput.js";
import { taskStopTool } from "./taskStop.js";
import { taskUpdateTool } from "./taskUpdate.js";
import { teamCreateTool } from "./teamCreate.js";
import { teamDeleteTool } from "./teamDelete.js";
import { teamStatusTool } from "./teamStatus.js";
import { todoWriteTool } from "./todoWrite.js";
import { toolSearchTool } from "./toolSearch.js";
import { uploadArtifactTool } from "./uploadArtifact.js";
import { viewDiffTool } from "./viewDiff.js";
import { webSearchTool } from "./webSearch.js";
import { writeChecklistTool } from "./writeChecklist.js";
import { writeFileTool } from "./writeFile.js";

// putting in here for circular import issue
export const ALL_BUILT_IN_TOOLS = [
  askQuestionTool,
  configTool,
  editTool,
  exitTool,
  fetchTool,
  gitTool,
  grepTool,
  globTool,
  githubTool,
  listFilesTool,
  listMcpResourcesTool,
  mcpAuthTool,
  multiEditTool,
  readFileTool,
  readMcpResourceTool,
  reportFailureTool,
  runTerminalCommandTool,
  searchCodeTool,
  sendMessageTool,
  sleepTool,
  statusTool,
  SUBAGENT_TOOL_META,
  SKILLS_TOOL_META,
  taskCreateTool,
  taskGetTool,
  taskListTool,
  taskOutputTool,
  taskStopTool,
  taskUpdateTool,
  teamCreateTool,
  teamDeleteTool,
  teamStatusTool,
  todoWriteTool,
  toolSearchTool,
  uploadArtifactTool,
  viewDiffTool,
  webSearchTool,
  writeChecklistTool,
  writeFileTool,
];
